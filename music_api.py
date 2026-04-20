import httpx

import base64
from pyDes import des, ECB, PAD_PKCS5

def decrypt_url(url, has_320="false"):
    try:
        des_cipher = des(b"38346591", ECB, b"\0\0\0\0\0\0\0\0", pad=None, padmode=PAD_PKCS5)
        enc_url = base64.b64decode(url.strip())
        dec_url = des_cipher.decrypt(enc_url, padmode=PAD_PKCS5).decode('utf-8')
        
        # JioSaavn URL format corrections for full AAC streams
        quality = '_320.mp4' if has_320 == "true" else '_160.mp4'
        final_url = dec_url.replace('_96_p.mp4', quality).replace('_96.mp4', quality)
        final_url = final_url.replace('preview.saavncdn.com', 'aac.saavncdn.com')
        
        return final_url
    except Exception as e:
        return None

def search_jiosaavn(query, limit=20):
    """
    Searches JioSaavn using direct API call.
    fetches full details to get encrypted_media_url and decrypts it.
    """
    try:
        # 1. Search for IDs
        search_url = "https://www.jiosaavn.com/api.php"
        search_params = {
            "__call": "search.getResults",
            "_format": "json",
            "n": limit,
            "p": 1,
            "_marker": "0",
            "ctx": "android",
            "q": query
        }
        
        with httpx.Client() as client:
            resp = client.get(search_url, params=search_params)
            resp.raise_for_status()
            data = resp.json()
            
        final_results = []
        if "results" in data:
            results = data["results"]
            
            # 2. Extract IDs for batch detail fetch
            pids = [item.get('id') for item in results if item.get('id')]
            if not pids:
                return []
                
            # 3. Fetch Full Details (Batch)
            details_params = {
                "__call": "song.getDetails",
                "_format": "json",
                "pids": ",".join(pids),
                "ctx": "android"
            }
            
            with httpx.Client() as client:
                details_resp = client.get(search_url, params=details_params)
                details_resp.raise_for_status()
                details_data = details_resp.json()
            
            # 4. Process Details
            # The API returns a dict keyed by ID { "id1": {...}, "id2": {...} }
            # We iterate through our original order to maintain relevance
            
            for pid in pids:
                if pid not in details_data:
                    continue
                    
                item = details_data[pid]
                
                # Image
                image_url = item.get('image', '').replace('150x150', '500x500').replace('50x50', '500x500')
                
                # Audio
                audio_url = None
                enc_url = item.get('encrypted_media_url')
                if enc_url:
                    audio_url = decrypt_url(enc_url, item.get("320kbps", "false"))
                
                # Fallback to preview if decryption fails
                if not audio_url:
                    audio_url = item.get('media_preview_url')
                
                # Metadata
                # API returns 'song' for title in getDetails too
                title = item.get("song") or item.get("title")
                artist_name = item.get("primary_artists") or item.get("singers") or ""
                album_name = item.get("album") or ""
                
                # Extra Metadata for Semantic Search
                language = item.get("language", "")
                year = item.get("year", "")
                label = item.get("label", "")
                
                song_info = {
                    "track_name": title,
                    "artist_name": artist_name,
                    "album_name": album_name,
                    "preview_url": audio_url, 
                    "artwork_url": image_url,
                    "view_url": item.get('perma_url'),
                    "source": "JioSaavn",
                    "id": item.get("id"),
                    
                    # Store extra metadata for later embedding
                    "language": language,
                    "year": year,
                    "label": label,
                    "has_320kbps": item.get("320kbps", "false")
                }
                final_results.append(song_info)
                
        return final_results
        
    except Exception as e:
        print(f"Error searching JioSaavn API: {e}")
        return []

def search_music(query, limit=20):
    """
    Searches music using JioSaavn.
    """
    results = {}
    
    # 1. JioSaavn
    jiosaavn_res = search_jiosaavn(query, limit)
    if jiosaavn_res:
        results["JioSaavn"] = jiosaavn_res
        
    return results
