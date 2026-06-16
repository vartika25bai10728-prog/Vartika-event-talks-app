import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify
import requests

app = Flask(__name__)

# Feed URL
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse Atom XML
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        title_elem = root.find('atom:title', ns)
        feed_title = title_elem.text if title_elem is not None else "BigQuery - Release Notes"
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            id_elem = entry.find('atom:id', ns)
            title_elem = entry.find('atom:title', ns)
            updated_elem = entry.find('atom:updated', ns)
            link_elem = entry.find('atom:link', ns)
            content_elem = entry.find('atom:content', ns)
            
            link_href = link_elem.attrib.get('href', '') if link_elem is not None else ''
            
            entries.append({
                'id': id_elem.text if id_elem is not None else '',
                'title': title_elem.text if title_elem is not None else '',
                'updated': updated_elem.text if updated_elem is not None else '',
                'link': link_href,
                'content': content_elem.text if content_elem is not None else ''
            })
            
        return jsonify({
            'success': True,
            'title': feed_title,
            'entries': entries
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
