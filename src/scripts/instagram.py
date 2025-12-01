import sys
import json
import re
import requests
import os
from urllib.parse import urlparse

def clean_url(url):
    parsed = urlparse(url)
    path = parsed.path
    if not path.endswith('/'):
        path += '/'
    return f"{parsed.scheme}://{parsed.netloc}{path}"

def parse_cookies(cookie_file):
    cookies = {}
    if os.path.exists(cookie_file):
        with open(cookie_file, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.startswith('#') and line.strip():
                    parts = line.split('\t')
                    if len(parts) >= 7:
                        cookies[parts[5]] = parts[6].strip()
    return cookies

def get_instagram_data(url, cookie_file):
    base_url = clean_url(url)
    api_url = f"{base_url}?__a=1&__d=dis"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json',
        'X-IG-App-ID': '936619743392459', # ID público do App Web do Insta
    }
    
    cookies = parse_cookies(cookie_file)
    
    result = {
        "views": 0, "likes": 0, "coments": 0, "saves": 0, "shares": 0,
        "name_account": "Instagram User", "thumbnail": ""
    }

    try:
        # Tenta pegar via API JSON direta (MUITO MAIS CONFIÁVEL)
        response = requests.get(api_url, headers=headers, cookies=cookies)
        
        try:
            data = response.json()
            
            # Navegação no JSON do Instagram (Shortcode Media)
            media = data.get("graphql", {}).get("shortcode_media") or data.get("items", [{}])[0]
            
            if media:
                # VIEWS
                result["views"] = media.get("video_view_count") or media.get("play_count") or media.get("view_count") or 0
                
                # LIKES
                result["likes"] = media.get("edge_media_preview_like", {}).get("count") or media.get("like_count") or 0
                
                # COMENTÁRIOS
                result["coments"] = media.get("edge_media_to_comment", {}).get("count") or media.get("comment_count") or 0
                
                # AUTOR
                owner = media.get("owner", {})
                result["name_account"] = owner.get("username") or owner.get("full_name") or "Instagram User"
                
                # THUMBNAIL (Imagem de capa)
                result["thumbnail"] = media.get("display_url") or media.get("image_versions2", {}).get("candidates", [{}])[0].get("url") or ""

                print(json.dumps(result))
                return

        except json.JSONDecodeError:
            pass # Falhou JSON, tenta HTML

    except Exception:
        pass

    # --- FALLBACK: HTML SCRAPE (Se a API falhar) ---
    try:
        response = requests.get(base_url, headers=headers, cookies=cookies)
        html = response.text
        
        # Thumbnail (Meta Tag og:image)
        thumb_match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        if thumb_match:
            result["thumbnail"] = thumb_match.group(1).replace('&amp;', '&')

        # Views
        views_match = re.search(r'"video_view_count":(\d+)', html) or re.search(r'"play_count":(\d+)', html)
        if views_match: result["views"] = int(views_match.group(1))

        # Likes
        likes_match = re.search(r'"edge_media_preview_like":\{"count":(\d+)', html) or re.search(r'"like_count":(\d+)', html)
        if likes_match: result["likes"] = int(likes_match.group(1))

        # Autor
        user_match = re.search(r'"username":"([^"]+)"', html)
        if user_match: 
            result["name_account"] = user_match.group(1)
        else:
             og_title = re.search(r'<meta property="og:title" content="([^"]+)"', html)
             if og_title and '(' in og_title.group(1):
                 result["name_account"] = og_title.group(1).split('(')[1].split(')')[0]

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Args missing"}))
    else:
        get_instagram_data(sys.argv[1], sys.argv[2])