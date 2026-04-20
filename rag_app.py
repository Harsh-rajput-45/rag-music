import os
import json
import numpy as np
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFaceEndpoint, ChatHuggingFace
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from music_api import search_music

load_dotenv()

# Global model caches
_embedding_model = None
_llm_chain = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        print("Loading embedding model...")
        _embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return _embedding_model

def get_llm_chain():
    global _llm_chain
    if _llm_chain is None:
        print("Loading LLM...")
        repo_id = "meta-llama/Meta-Llama-3-8B-Instruct"
        llm = HuggingFaceEndpoint(
            repo_id=repo_id,
            task="text-generation",
            temperature=0.7,
            max_new_tokens=256,
            do_sample=True,
            huggingfacehub_api_token=os.environ.get("HUGGINGFACEHUB_API_TOKEN") 
        )
        chat_llm = ChatHuggingFace(llm=llm)
        
        system_prompt = """You are an intelligent music search router.
        Analyze the user's query and classify the intent into one of three categories:
        - "EXACT": The user is looking for a specific song name, artist name, or exact lyrics (e.g. "kyunki tum hi ho", "Arijit Singh", "shape of you").
        - "VIBE": The user is describing a mood, activity, or vague feeling (e.g. "fitness motivation", "sad songs for rain").
        - "HYBRID": The user provided BOTH a specific artist/song AND a vibe (e.g. "sad songs by Arijit Singh", "tum hi ho but upbeat").

        Based on the intent, generate a JSON object with:
        "intent": "EXACT" | "VIBE" | "HYBRID"
        "queries": A list of search queries to send to the music database.

        Guidelines for "queries" array:
        - If EXACT, output EXACTLY the raw string they provided (do not change or translate it).
        - If VIBE, output 3 highly diverse conceptual keywords (e.g., ["Gym Heavy Metal", "Bollywood Workout Soundtrack", "High Tempo"]).
        - If HYBRID, output 1 query that is the exact Artist/Song name, and 1 query that describes the vibe (e.g., ["Arijit Singh", "Sad Hindi Songs"]).

        Output ONLY valid JSON.
        Example 1:
        Input: "lines between the song zara tasveer se tu"
        Output: {{"intent": "EXACT", "queries": ["zara tasveer se tu"]}}

        Example 2: 
        Input: "songs for workout"
        Output: {{"intent": "VIBE", "queries": ["High Energy Gym", "Bollywood Workout", "Rock Anthem"]}}
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{question}"),
        ])
        
        _llm_chain = prompt | chat_llm | StrOutputParser()
        
    return _llm_chain

def cosine_similarity(v1, v2):
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    return dot_product / (norm_v1 * norm_v2) if norm_v1 > 0 and norm_v2 > 0 else 0.0

def recommend_songs(query, fast_mode=False, reference_song=None):
    """
    Hybrid Recommendation with Query Expansion:
    1. LLM: Expand 'vibe' -> [Keywords]
    2. API: Search(Keywords) -> [Candidates]
    3. Semantic: Re-rank(Query, Candidates)
    """
    try:
        print(f"Hybrid Search for: '{query}' (Fast Mode: {fast_mode})")
        
        # 1. Query Expansion (LLM or Metadata)
        search_queries = []
        intent = "VIBE"
        
        if not fast_mode:
            try:
                chain = get_llm_chain()
                response = chain.invoke({"question": query})
                print("LLM Response Raw:", response)
                
                # Parse JSON
                start = response.find('{')
                end = response.rfind('}') + 1
                if start != -1 and end != -1:
                    parsed = json.loads(response[start:end])
                    # Force VIBE if reference song is provided to ensure semantic re-ranking takes place
                    intent = "VIBE" if reference_song else parsed.get("intent", "VIBE")
                    q_list = parsed.get("queries", [])
                    
                    if isinstance(q_list, list) and len(q_list) > 0:
                        search_queries = [str(i) for i in q_list]
                        print(f"LLM Intent: {intent}, Queries: {search_queries}")
            except Exception as e:
                print(f"LLM parsing failed: {e}. Falling back to metadata.")
        
        # Fallback to metadata if LLM didn't return search queries or if fast_mode is True
        if not search_queries:
            if reference_song:
                intent = "VIBE"
                if reference_song.get('artist_name'):
                    search_queries.append(reference_song['artist_name'])
                lang_year = f"{reference_song.get('language', '')} {reference_song.get('year', '')}".strip()
                if lang_year:
                    search_queries.append(f"{lang_year} hits")
            
            if not search_queries:
                search_queries = [query]
        # 2. Retrieval (API)
        all_candidates = []
        seen_ids = set()
        
        # Fetch more candidates to give the Semantic AI a richer pool to choose from
        limit_per_query = 50 
        
        for q in search_queries:
            api_res = search_music(q, limit=limit_per_query)
            if api_res and "JioSaavn" in api_res:
                for song in api_res["JioSaavn"]:
                    sid = song.get('id')
                    # Deduplicate
                    if sid and sid not in seen_ids:
                        seen_ids.add(sid)
                        all_candidates.append(song)
                    elif not sid: # If no ID, add anyway (unlikely)
                        all_candidates.append(song)
        
        if not all_candidates:
            return {}
            
        print(f"Total Unique Candidates: {len(all_candidates)}")
        
        if intent == "EXACT" and not reference_song:
            # For exact intent, DO NOT apply semantic re-ranking.
            # Preserve JioSaavn's native order as it guarantees lyric/keyword match!
            print("Skipping semantic re-ranking due to EXACT intent.")
            return {"JioSaavn": all_candidates[:20]}

        # 3. Semantic Re-ranking
        try:
            model = get_embedding_model()
            
            # Embed User's Original Semantic Query (not the keywords)
            if reference_song:
                # Year is EXCLUDED from embedding — vibe/semantics must drive cosine similarity.
                # Year is re-introduced as a gentle bonus scalar after scoring (see below).
                query_text = (
                    f"{reference_song.get('track_name', '')} "
                    f"{reference_song.get('artist_name', '')} "
                    f"{reference_song.get('album_name', '')} "
                    f"{reference_song.get('language', '')}"
                ).strip()
                ref_year = int(reference_song.get('year', 0) or 0)
                print("Using dense reference song embedding — year excluded for pure vibe match.")
                query_embedding = model.embed_query(query_text)
            else:
                ref_year = 0
                query_embedding = model.embed_query(query)
            
            # Embed Candidates — year also excluded from candidate text
            candidate_texts = []
            for song in all_candidates:
                text = (
                    f"{song.get('track_name', '')} "
                    f"{song.get('artist_name', '')} "
                    f"{song.get('album_name', '')} "
                    f"{song.get('language', '')}"
                ).strip()
                candidate_texts.append(text)
                
            candidate_embeddings = model.embed_documents(candidate_texts)
            
            # Calculate Scores — pure cosine similarity first
            scored_candidates = []
            for i, song in enumerate(all_candidates):
                semantic_score = cosine_similarity(query_embedding, candidate_embeddings[i])
                
                # Apply a gentle year-proximity bonus (max +0.05) as a secondary tie-breaker.
                # This nudges semantically equal songs toward the same era WITHOUT overriding vibe.
                year_bonus = 0.0
                if ref_year > 0:
                    try:
                        cand_year = int(song.get('year', 0) or 0)
                        if cand_year > 0:
                            year_diff = abs(ref_year - cand_year)
                            # Exponential decay: same year = +0.05, 5 years apart ≈ +0.01, 10+ ≈ ~0
                            year_bonus = 0.05 * (0.75 ** year_diff)
                    except (ValueError, TypeError):
                        pass
                
                final_score = semantic_score + year_bonus
                song['similarity_score'] = float(semantic_score)  # Store raw for transparency
                scored_candidates.append((final_score, song))
            
            # Sort by final_score (semantic + year nudge)
            scored_candidates.sort(key=lambda x: x[0], reverse=True)
            
            # 4. Format Results (Return Top 20)
            top_songs = [item[1] for item in scored_candidates[:20]]
            
            return {"JioSaavn": top_songs}
            
        except Exception as e:
            print(f"Semantic Re-ranking failed: {e}")
            return {"JioSaavn": all_candidates[:20]}
        
    except Exception as e:
        print(f"Error in recommendation: {e}")
        return {}

if __name__ == "__main__":
    # Test
    res = recommend_songs("Latest Punjabi Hits")
    print(res.keys())
