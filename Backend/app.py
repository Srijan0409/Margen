import os
import sys
import random
import json
import time
import re
import concurrent.futures
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from twilio.rest import Client
import google.generativeai as genai
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

# ============================================================
# 1. INITIALIZATION & CONFIGURATION
# ============================================================
load_dotenv()

app = Flask(__name__, template_folder='../Frontend', static_folder='../Frontend/static', static_url_path='/static')
CORS(app)

# --- Database Configuration ---
# Supports PostgreSQL on Render (via DATABASE_URL env var) and falls back to SQLite locally.
# This fixes the "SQLite wiped on every redeploy" issue on Render's ephemeral filesystem.
database_url = os.getenv("DATABASE_URL", "sqlite:///" + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'users.db'))
# Render provides Postgres URLs starting with 'postgres://' but SQLAlchemy needs 'postgresql://'
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Twilio Configuration ---
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None

# --- Gemini AI Configuration ---
gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    print("CRITICAL ERROR: GEMINI_API_KEY not found. The application cannot start.", file=sys.stderr)
    sys.exit(1)

genai.configure(api_key=gemini_api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

# ============================================================
# 2. DATABASE MODELS
# ============================================================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    profile_data = db.Column(db.Text, nullable=True)

class OTP(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    otp_code = db.Column(db.String(6), nullable=False)
    # FIX: Added created_at so OTPs can expire after 10 minutes (security fix)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

with app.app_context():
    db.create_all()

# ============================================================
# 3. GLOBAL ERROR HANDLERS & HEALTH CHECK
# ============================================================
@app.errorhandler(500)
def internal_error(e):
    print(f"Global 500 Error: {e}")
    return jsonify({"error": "An internal server error occurred"}), 500

@app.errorhandler(404)
def not_found_error(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.route('/health')
def health():
    """
    Health check endpoint.
    TIP: Ping this every 5 minutes using UptimeRobot (free) to prevent
    Render's free tier from spinning down your server.
    URL to monitor: https://margen-1-f633.onrender.com/health
    """
    return jsonify({"status": "ok", "message": "MARGEN AI Backend is running"})

# ============================================================
# 4. CORE AI HELPER — with timeout, retries, and safe JSON extraction
# ============================================================
# FIX: Added a hard 25-second timeout using concurrent.futures to prevent
# Render's 30s proxy from killing the connection with a 502/504 error.
GEMINI_TIMEOUT_SECONDS = 25

def _call_gemini(prompt):
    """Internal wrapper to run Gemini in a thread so we can enforce a timeout."""
    return model.generate_content(prompt)

def generate_ai_response(prompt, expect_json=True, retries=2):
    """
    Universal helper to call Gemini API with:
      - Hard 25-second timeout per attempt
      - Automatic retries (default 2) with 2-second delay
      - Safe JSON extraction via regex
    Returns parsed JSON (dict/list) if expect_json=True.
    Returns raw text string if expect_json=False.
    Returns None if all retries are exhausted.
    """
    if not model:
        print("Error: AI model not configured.")
        return None

    for attempt in range(retries + 1):
        try:
            print(f"--- AI Request Attempt {attempt + 1}/{retries + 1} ---")

            # Run Gemini call in a thread with a strict timeout
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_call_gemini, prompt)
                response = future.result(timeout=GEMINI_TIMEOUT_SECONDS)

            raw_text = response.text
            print(f"RAW RESPONSE: {raw_text[:300]}...")  # Log first 300 chars only

            if not expect_json:
                return raw_text

            # Safely extract JSON — strip markdown fences first, then regex
            cleaned = re.sub(r'```(?:json)?', '', raw_text).strip().strip('`').strip()
            match = re.search(r'(\[.*\]|\{.*\})', cleaned, re.DOTALL)
            if not match:
                raise ValueError("No JSON array or object found in AI response.")

            json_data = json.loads(match.group())
            return json_data

        except concurrent.futures.TimeoutError:
            print(f"AI request timed out after {GEMINI_TIMEOUT_SECONDS}s on attempt {attempt + 1}.")
        except json.JSONDecodeError as e:
            print(f"JSON parse error on attempt {attempt + 1}: {e}")
        except Exception as e:
            print(f"AI Generation Error on attempt {attempt + 1}: {e}")

        if attempt < retries:
            print("Retrying in 2 seconds...")
            time.sleep(2)
        else:
            print("All AI retries failed.")

    return None

# ============================================================
# 5. API ROUTES
# ============================================================

# --- Root Route ---
@app.route('/')
def index():
    return render_template('index.html')

# ============================================================
# AUTHENTICATION & USER DATA ROUTES
# ============================================================
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"error": "Missing email or password"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 409

    hashed_password = generate_password_hash(data['password'])
    new_user = User(email=data['email'], password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created successfully"}), 201


@app.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"error": "Missing email or password"}), 400
    user = User.query.filter_by(email=data['email']).first()
    if user and check_password_hash(user.password, data['password']):
        return jsonify({"message": "Login successful", "identifier": user.email}), 200
    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/send-otp', methods=['POST'])
def send_otp():
    if not twilio_client:
        return jsonify({"error": "Twilio client not configured on the server."}), 500
    data = request.get_json()
    phone = data.get('phone')
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400

    otp_code = str(random.randint(100000, 999999))
    existing_otp = OTP.query.filter_by(phone=phone).first()
    if existing_otp:
        existing_otp.otp_code = otp_code
        existing_otp.created_at = datetime.utcnow()  # FIX: Reset expiry timer on resend
    else:
        db.session.add(OTP(phone=phone, otp_code=otp_code))
    db.session.commit()

    try:
        twilio_client.messages.create(
            body=f"Your MARGEN AI verification code is: {otp_code}. It expires in 10 minutes.",
            from_=TWILIO_PHONE_NUMBER,
            to=phone
        )
        return jsonify({"message": f"OTP sent to {phone}"}), 200
    except Exception as e:
        print(f"Twilio Error: {e}")
        return jsonify({"error": "Failed to send OTP. Please check the phone number format (+country code) and server setup."}), 500


@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    if not data or 'phone' not in data or 'code' not in data:
        return jsonify({"error": "Phone number and OTP code are required"}), 400

    otp_entry = OTP.query.filter_by(phone=data['phone'], otp_code=data['code']).first()

    if not otp_entry:
        return jsonify({"error": "Invalid OTP code"}), 401

    # FIX: Enforce 10-minute OTP expiry (security fix)
    otp_age = datetime.utcnow() - otp_entry.created_at
    if otp_age > timedelta(minutes=10):
        db.session.delete(otp_entry)
        db.session.commit()
        return jsonify({"error": "OTP has expired. Please request a new one."}), 401

    # OTP is valid — clean it up and log the user in
    db.session.delete(otp_entry)
    db.session.commit()
    return jsonify({"message": "Login successful", "identifier": data['phone']}), 200


@app.route('/save-profile', methods=['POST'])
def save_profile():
    data = request.get_json()
    email = data.get('email')
    profile_data = data.get('profile')
    if not email or not profile_data:
        return jsonify({"error": "Email and profile data are required"}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        user.profile_data = json.dumps(profile_data)
        db.session.commit()
        return jsonify({"message": "Profile saved successfully"}), 200
    return jsonify({"error": "User not found"}), 404

# ============================================================
# CORE AI ROUTES
# ============================================================
@app.route('/find-interests', methods=['POST'])
def find_interests():
    if not model:
        return jsonify({"error": "AI model not configured"}), 500

    # FIX: Guard against None if request body is missing
    body = request.get_json()
    if not body:
        return jsonify({"error": "Request body is required"}), 400
    data = body.get('answers', {})

    prompt = f"""
    Analyze a user's personality based on their answers to an interest assessment quiz.
    Based on these answers, generate a comma-separated list of 3 to 5 highly relevant interests for them.
    The interests should be concise and professional (e.g., "Data Analysis, Creative Design, Project Management").

    User's Answers:
    1. On a free weekend, they'd be: {data.get('q1', 'not answered')}
    2. Fascinating topic: {data.get('q2', 'not answered')}
    3. Enjoys tasks involving: {data.get('q3', 'not answered')}
    4. New project idea: {data.get('q4', 'not answered')}
    5. Comfortable working with: {data.get('q5', 'not answered')}

    Respond ONLY with the comma-separated list of interests and nothing else.
    """
    # FIX: Use the safe helper with timeout & retries instead of calling model directly
    result = generate_ai_response(prompt, expect_json=False)
    if not result:
        return jsonify({"error": "Could not analyze interests. Please try again."}), 500
    return jsonify({"interests": result.strip()})


@app.route('/generate-careers', methods=['POST'])
def generate_careers():
    if not model:
        return jsonify({"error": "AI model not configured"}), 500
    data = request.get_json() or {}

    prompt = f"""
    Based on the following user profile, generate a diverse list of 7 creative and professional career path recommendations.
    - Interests: "{data.get('interests', 'Not specified')}"
    - Skills: "{data.get('skills', 'Not specified')}"
    - Preferred Pace: "{data.get('pace', 'Balanced')}"
    - Life Goals: "{', '.join(data.get('lifeGoals', []))}"

    Respond STRICTLY with a JSON array of objects. Do NOT include any markdown formatting (like ```json), introduction, or extra text.
    Each object MUST have a "title" and a short "description" (around 15-20 words).

    Example format:
    [
      {{"title": "Software Engineer", "description": "Build scalable software applications."}},
      {{"title": "UX Designer", "description": "Design user-friendly interfaces."}}
    ]
    """
    fallback_data = [
        {"title": "Software Engineer", "description": "Build robust, scalable software applications and systems."},
        {"title": "Data Scientist", "description": "Analyze complex data to help companies make informed business decisions."},
        {"title": "Product Manager", "description": "Guide the strategy and development of new products from conception to launch."}
    ]

    json_data = generate_ai_response(prompt, expect_json=True)
    if not json_data:
        print("generate_ai_response failed for careers, using fallback data.")
        return jsonify(fallback_data)

    try:
        if not isinstance(json_data, list):
            raise ValueError("Response is not a JSON array")
        for item in json_data:
            if "title" not in item or "description" not in item:
                raise ValueError("JSON object missing 'title' or 'description'")
        return jsonify(json_data)
    except Exception as validation_error:
        print(f"Validation Error: {validation_error}. Returning fallback data.")
        return jsonify(fallback_data)


@app.route('/generate-future-scope', methods=['POST'])
def generate_future_scope():
    # FIX: Added model guard (was missing)
    if not model:
        return jsonify({'error': 'AI model not configured'}), 500

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    career_title = data.get('careerTitle')
    if not career_title:
        return jsonify({'error': 'Career title is required'}), 400

    prompt = f"""
    You are an expert career analyst and technology futurist specializing in the Indian job market. The current year is 2025. Your task is to generate a comprehensive and encouraging "Future Scope in India" analysis for the career path of a: "{career_title}".

    The analysis must be structured, detailed, and exclusively focused on the Indian context. Format the entire output as clean Markdown.

    Use the following structure with the specified headings and emojis:

    ## 🇮🇳 Market Outlook & Demand
    Provide a 2-3 paragraph summary of the current demand for this role in India. Is it a growing field? What are the key drivers for its growth (e.g., Digital India, startup ecosystem, global capability centers)?

    ## 🏙️ Key Hiring Hubs
    List the top 5-6 cities in India that are hotspots for this career, briefly explaining why (e.g., Bengaluru for its startup culture, Hyderabad for its pharma and tech parks).

    ## 💰 Salary Projections (INR)
    Provide estimated annual salary ranges in Indian Rupees (₹) for different experience levels. Use a Markdown table:
    | Experience Level      | Salary Range (Per Annum) | Notes                               |
    | --------------------- | ------------------------ | ----------------------------------- |
    | Entry-Level (0-2 Yrs) | *Your Estimate* | Fresh graduates from top-tier colleges |
    | Mid-Level (3-7 Yrs)   | *Your Estimate* | Strong portfolio, proven skills       |
    | Senior-Level (8+ Yrs) | *Your Estimate* | Team leadership, architectural skills |

    ## 🚀 Career Progression Path
    Outline a typical career ladder for a professional in this field in India.

    ## 🛠️ Essential & Future-Proofing Skills
    Create two lists:
    - **Core Skills for Today:** List the top 5-7 non-negotiable skills required right now.
    - **Skills for Tomorrow (2027-2030):** List 3-5 emerging skills or technologies that professionals in this role should start learning to stay ahead in the Indian market.

    ## 🏢 Top Companies Hiring in India
    List a mix of 8-10 prominent companies hiring for this role in India. Include both major MNCs and leading Indian startups.

    Conclude with a final, motivational paragraph summarizing why India is an exciting place for a "{career_title}" right now.
    """

    # FIX: Was calling model.generate_content() directly (no timeout, no retries, no error handling).
    # Now uses the safe generate_ai_response() helper.
    result = generate_ai_response(prompt, expect_json=False)
    if not result:
        return jsonify({'error': 'AI failed to generate future scope analysis. Please try again.'}), 500

    return jsonify({'scope': result})


@app.route('/generate-roadmap', methods=['POST'])
def generate_roadmap():
    if not model:
        return jsonify({"error": "AI model not configured"}), 500
    data = request.get_json() or {}
    career_title = data.get('careerTitle', 'the selected career')

    prompt = f"""
    You are an expert career advisor. Create a detailed, step-by-step learning roadmap for a user aspiring to become a "{career_title}".
    The roadmap must be structured as a JSON array of 3 to 5 major milestone objects.

    Each milestone object in the array must contain:
    1. A "title" (string): A clear and concise name for the milestone.
    2. A "skills" (array of objects): A list of key skills to learn in this milestone.

    Each skill object within the "skills" array must contain:
    1. A "name" (string): The name of the skill or technology.
    2. A "resource" (object): A single, high-quality, real learning resource.

    Each resource object must contain:
    1. A "name" (string): The name of the resource provider or type.
    2. A "link" (string): A direct, valid, and clickable HTTPS URL to the resource.

    Respond STRICTLY with ONLY a valid JSON array of these milestone objects. Do NOT include any explanatory text, markdown formatting (like ```json), introduction, or any other characters outside of the JSON structure.

    Example format:
    [
      {{
        "title": "Basics",
        "skills": [
          {{
            "name": "Python",
            "resource": {{
              "name": "FreeCodeCamp",
              "link": "https://freecodecamp.org"
            }}
          }}
        ]
      }}
    ]
    """
    json_data = generate_ai_response(prompt, expect_json=True)

    if not json_data:
        print("generate_ai_response failed for roadmap, using fallback data.")
        return jsonify([
            {
                "title": "Foundations",
                "skills": [
                    {
                        "name": "Core Concepts",
                        "resource": {
                            "name": "FreeCodeCamp",
                            "link": "https://www.freecodecamp.org/"
                        }
                    }
                ]
            }
        ])

    return jsonify(json_data)


@app.route('/analyze-skills', methods=['POST'])
def analyze_skills():
    """Performs skill gap analysis — pure Python logic, no AI call needed."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    user_skills_raw = data.get('userSkills', '')
    roadmap = data.get('roadmap', [])
    if not user_skills_raw or not roadmap:
        return jsonify({"error": "Missing user skills or roadmap data."}), 400

    user_skills = {s.strip().lower() for s in user_skills_raw.split(',') if s.strip()}
    required_skills = {skill['name'].lower() for milestone in roadmap for skill in milestone.get('skills', [])}
    skills_have = {req for req in required_skills if any(us in req for us in user_skills)}
    skills_to_learn = required_skills - skills_have
    percentage = round((len(skills_have) / len(required_skills)) * 100) if required_skills else 0

    def capitalize_skill(s):
        return ' '.join(word.capitalize() for word in s.split())

    return jsonify({
        "percentage": percentage,
        "skillsHave": sorted(list(map(capitalize_skill, skills_have))),
        "skillsToLearn": sorted(list(map(capitalize_skill, skills_to_learn)))
    })


@app.route('/generate-project-pitch', methods=['POST'])
def generate_project_pitch():
    if not model:
        return jsonify({"error": "AI model not configured"}), 500
    data = request.get_json() or {}
    interests = data.get('interests', 'general topics')
    skills = data.get('skills', [])
    milestone_title = data.get('milestoneTitle', 'the current milestone')

    if not skills:
        return jsonify({"error": "Skills are required for a project pitch."}), 400

    prompt = f"""
    Based on a user's interest in "{interests}" and the required skills for the milestone "{milestone_title}" which are [{', '.join(skills)}], generate a single, creative, and actionable project idea.
    The project idea should help the user practice the specified skills.
    Describe the project in a concise paragraph (about 50-70 words).

    Respond ONLY with a valid JSON object containing a single key "pitch" with the project description as its value.
    Example: {{"pitch": "Build an interactive portfolio website using React that dynamically showcases your projects and includes a blog section."}}
    """
    # FIX: Was calling model.generate_content() directly AND using undefined clean_json_response().
    # Both are replaced with the safe generate_ai_response() helper.
    result = generate_ai_response(prompt, expect_json=True)
    if not result or 'pitch' not in result:
        return jsonify({"error": "AI failed to generate a project pitch. Please try again."}), 500

    return jsonify(result)


# ============================================================
# MOCK INTERVIEW ROUTES
# ============================================================
@app.route('/start-interview', methods=['POST'])
def start_interview():
    if not model:
        return jsonify({"error": "AI model not configured"}), 500
    data = request.get_json() or {}
    career_title = data.get('careerTitle', 'the selected field')

    prompt = f"""
    You are an expert, friendly hiring manager conducting a mock interview for a "{career_title}" position.
    Start the interview with a welcoming greeting and then ask your first, open-ended question to gauge the candidate's interest and background.
    Keep your response to a single, concise paragraph.
    """
    # FIX: Use safe helper with timeout/retries
    result = generate_ai_response(prompt, expect_json=False)
    if not result:
        return jsonify({"error": "Failed to start the interview. Please try again."}), 500
    return jsonify({"greeting": result.strip()})


@app.route('/continue-interview', methods=['POST'])
def continue_interview():
    if not model:
        return jsonify({"error": "AI model not configured"}), 500
    data = request.get_json() or {}
    career_title = data.get('careerTitle', 'the selected field')
    conversation = data.get('conversation', [])

    history_text = ""
    for turn in conversation:
        role = "You (Interviewer)" if turn['role'] == 'model' else "Candidate"
        # FIX: Guard against missing 'parts' key to prevent KeyError crash
        parts = turn.get('parts', [])
        text = parts[0].get('text', '') if parts else ''
        history_text += f"{role}: {text}\n"

    prompt = f"""
    You are an expert, friendly hiring manager continuing a mock interview for a "{career_title}" position.
    Here is the conversation so far:
    {history_text}
    Based on the candidate's last response, ask a relevant follow-up question or provide brief feedback.
    Keep the conversation flowing naturally. Your response should be a single, concise paragraph.
    Do not repeat questions. Ask behavioral, situational, or technical questions as appropriate for the role.
    """
    # FIX: Use safe helper with timeout/retries
    result = generate_ai_response(prompt, expect_json=False)
    if not result:
        return jsonify({"error": "Failed to continue the interview. Please try again."}), 500
    return jsonify({"text": result.strip()})


# ============================================================
# 6. RUN THE APP
# ============================================================
if __name__ == '__main__':
    port = int(os.getenv("PORT", 5001))
    try:
        from waitress import serve
        print(f"Starting production server with Waitress on port {port}...")
        serve(app, host="0.0.0.0", port=port)
    except ImportError:
        print("Waitress not found, falling back to Flask development server...")
        app.run(debug=True, port=port)
