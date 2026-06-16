# BigQuery Release Hub

A modern developer portal and tweeting companion designed for Google Cloud BigQuery release notes. The application automatically fetches the official BigQuery release notes XML feed, parses the contents into searchable update logs, and allows users to draft, preview, and share updates on X (formerly Twitter) instantly.

---

## 🌟 Features

- **Backend Feed Proxy**: Fetches official release feed XML dynamically via Python Flask, avoiding browser CORS blockades.
- **Granular Update Parser**: Converts compound daily updates into separate cards categorized as **Feature**, **Issue**, **Deprecation**, or **General**.
- **Real-Time Statistics**: Live dashboards tracking total release volumes and counts per category.
- **Instant Search & Category Filtering**: Instantly search updates by keywords or filter by category tags.
- **X/Twitter Composer Integration**: 
  - Dynamic template creation based on selected release note cards.
  - Automatic description-truncation ensuring drafts never exceed the **280 character limit**.
  - Animated SVG character gauge showing safe, warning, and limit-exceeded indicator colors.
  - One-click copy or direct redirection to X Web Intent.

---

## 🛠️ Technology Stack

- **Backend**: Python, Flask, requests, xml.etree.ElementTree
- **Frontend**: HTML5, Vanilla CSS3 (Custom Dark Theme, Flexbox, Responsive Grid), Vanilla JavaScript ES6

---

## 📂 Codebase Structure

```text
bigquery-release-notes-app/
├── app.py                  # Main Flask application and JSON proxy endpoint
├── requirements.txt        # Backend dependencies (Flask, requests)
├── .gitignore              # Git ignore configurations
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Core dashboard HTML structure
└── static/
    ├── css/
    │   └── style.css       # Custom design system styling (dark theme, variables)
    └── js/
        └── app.js          # Client-side parser, analytics, composer, and events
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Python (version 3.8 or higher) installed on your system.

### Installation

1. Navigate to the project directory:
   ```bash
   cd bigquery-release-notes-app
   ```

2. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

1. Start the Flask application:
   ```bash
   python app.py
   ```

2. Open your web browser and go to:
   ```text
   http://127.0.0.1:5000
   ```

---

## 🧩 How it Works: Request-Response Flow

1. The client-side script fetches data from the Flask API `/api/release-notes`.
2. Flask queries `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml` and converts the raw Atom XML feed into a structured JSON dataset.
3. The frontend parses the CDATA HTML tags and populates update cards in the dashboard.
4. When a card is selected, it fills the side panel details, templates a tweet, and calculates character limits dynamically for instant sharing.
