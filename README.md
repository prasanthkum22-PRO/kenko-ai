# KENKO-AI (MediBridge AI)
> *"From Conversation to Connected Care"*  
> **AI-Powered Ambient Clinical Consultation Intelligence, Multilingual Speech-to-Text, Medical OCR & Multidisciplinary Telehealth Hub**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![faster-whisper](https://img.shields.io/badge/STT-faster--whisper-orange.svg?style=flat-square)](https://github.com/SYSTRAN/faster-whisper)
[![Ollama](https://img.shields.io/badge/Local%20LLM-Ollama%20(Qwen2.5%20%2F%20LLaMA3)-blueviolet.svg?style=flat-square&logo=ollama&logoColor=white)](https://ollama.com)
[![OCR](https://img.shields.io/badge/OCR-Google%20Gemini%20Vision%20%2F%20PaddleOCR-blue.svg?style=flat-square)](https://cloud.google.com/vision)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20SQLAlchemy-003B57.svg?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Key Capabilities](#-key-capabilities)
3. [System Architecture & Data Flow](#-system-architecture--data-flow)
4. [Five Dedicated Role Workspaces](#-five-dedicated-role-workspaces)
5. [Core Clinical Modules](#-core-clinical-modules)
   - [Multilingual Speech-to-Text & Diarization](#1-multilingual-speech-to-text--diarization)
   - [Zero-Hallucination Clinical Extraction](#2-zero-hallucination-clinical-extraction)
   - [Doctor Review, Live Editing & Versioned Audit](#3-doctor-review-live-editing--versioned-audit)
   - [Central Multidisciplinary Care Routing](#4-central-multidisciplinary-care-routing)
   - [Follow-Up Intelligence & SLA Engine](#5-follow-up-intelligence--sla-engine)
   - [Prescription Studio & Medical OCR](#6-prescription-studio--medical-ocr)
   - [Patient Care Timeline & Grounded Q&A Chatbot](#7-patient-care-timeline--grounded-qa-chatbot)
6. [Technology Stack](#-technology-stack)
7. [Repository Structure](#-repository-structure)
8. [Quick Start & Installation Guide](#-quick-start--installation-guide)
   - [Prerequisites](#1-prerequisites)
   - [Ollama Local LLM Setup](#2-ollama-local-llm-setup)
   - [Backend Installation](#3-backend-installation)
   - [Frontend Installation](#4-frontend-installation)
9. [Environment Configuration Reference](#-environment-configuration-reference)
10. [Default Demo Accounts & RBAC Roles](#-default-demo-accounts--rbac-roles)
11. [REST API Endpoint Reference](#-rest-api-endpoint-reference)
12. [Automated Testing & Quality Assurance](#-automated-testing--quality-assurance)
13. [Clinical Safety, Privacy & HIPAA Posture](#-clinical-safety-privacy--hipaa-posture)
14. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🏥 Executive Summary

**KENKO-AI (MediBridge AI)** is an enterprise-grade, privacy-first clinical AI platform designed to eliminate the administrative burden on healthcare providers while improving patient adherence and safety. 

During typical outpatient visits and telehealth consultations, clinicians spend up to 40% of their time manually writing notes, translating codes, entering lab orders, and generating patient discharge instructions. KENKO-AI captures spoken doctor-patient interactions (in English, Tamil, or Tamil-English code-mixed speech), transcribes dialogue with speaker diarization, extracts structured clinical facts with exact source timestamp quotes using local open-source LLMs (`Ollama`), and routes action items automatically across hospital departments.

### 🔒 100% Local, Offline-Capable & Privacy-Preserving
- **Zero Audio Cloud Egress**: Speech transcription and LLM inference run entirely on-premise using `faster-whisper` and `Ollama`.
- **No Third-Party Paid API Dependency**: Completely operational without external proprietary LLM subscriptions.
- **Doctor-in-the-Loop Safety**: AI extractions remain in draft status (`PENDING_DOCTOR_CONFIRMATION`) until a licensed clinician reviews, modifies, and signs off.

---

## 🌟 Key Capabilities

* 🎙️ **Multilingual Ambient Speech-to-Text**: Automatic language detection supporting **English**, **Tamil**, and **Tamil-English (Tanglish)** code-mixed dialogues with speaker turn separation (`Doctor` vs. `Patient`).
* 🩺 **Structured Fact Extraction**: Zero-hallucination extraction of Chief Complaint, Symptoms (with duration & quotes), Vitals, Past History & Allergies, Lab Tests, Medications (Dosage, Frequency, Duration, Instructions), and Follow-ups.
* ✍️ **Doctor Workspace & Collaborative Editing**: Interactive clinical workbench allowing physicians to edit, insert, or delete any extracted segment before final atomic sign-off.
* 🔀 **Central Multidisciplinary Task Routing**: Automatic fan-out upon consultation sign-off into:
  - Doctor Follow-up Hub
  - Nursing Vitals Monitoring Queue
  - Diagnostic Lab Requisitions (with STAT / Urgent / Normal priority)
  - Pharmacy Dispensing Pipeline
  - Patient Plain-Language Timeline
* 📅 **Follow-Up Intelligence Hub**: Dynamic state-machine tracking (`PENDING_DOCTOR_CONFIRMATION` ➔ `CONFIRMED` ➔ `REMINDER_SCHEDULED` ➔ `COMPLETED`) with color-coded urgency alerts (🟢 Upcoming, 🟡 Due Today, 🔴 Overdue).
* 📷 **Prescription Studio & Medical Document OCR**: Deciphers handwritten prescriptions, lab sheets, and printed clinical records using dual-engine OCR (**Google Gemini Vision** / **PaddleOCR**) and parses drug dosages into structured digital entries.
* 💬 **Grounded Consultation Q&A Chatbot**: A patient-facing assistant that answers questions **strictly** from verified consultation transcripts and clinical notes, explicitly rejecting out-of-scope medical inquiries.
* 🛡️ **Role-Based Access Control (RBAC) & Audit Trails**: Real JWT token authentication, PBKDF2 password hashing, and immutable action logging for full clinical compliance.

---

## 🏛️ System Architecture & Data Flow

```
                                  CLINICAL AUDIO INPUT
               (In-Person Ambient Microphone / Telehealth Video Call)
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │   faster-whisper Multilingual   │
                         │    Speech-to-Text Engine        │
                         └─────────────────────────────────┘
                                          │
                            [Transcripts + Speaker Tags]
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │   Ollama Local LLM Extractor    │
                         │    (Qwen 2.5 7B / LLaMA 3.2 3B)  │
                         └─────────────────────────────────┘
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             ▼                            ▼                            ▼
   Structured Facts               Follow-Up Commitments       Patient-Friendly Guide
 (Meds, Vitals, Tests, Sx)    (PENDING_DOCTOR_CONFIRMATION)   (Plain Language Summary)
             └────────────────────────────┬────────────────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │  Doctor Review & Finalization   │
                         │  (Edit, Validate, Add Warnings) │
                         └─────────────────────────────────┘
                                          │ [Sign-Off]
                                          ▼
                         ┌─────────────────────────────────┐
                         │ Central Multidisciplinary Router│
                         └─────────────────────────────────┘
                                          │
     ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
     ▼                  ▼                 ▼                 ▼                  ▼
┌─────────┐      ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    ┌─────────────┐
│ Doctor  │      │  Follow-Up  │   │  Diagnostic │   │   Nursing   │    │   Patient   │
│ Records │      │     Hub     │   │  Lab Queue  │   │ Care Tasks  │    │  Timeline & │
│ (EHR)   │      │ (SLA Alert) │   │ (STAT/Urgent│   │ (Vitals Mon)│    │ Chatbot Q&A │
└─────────┘      └─────────────┘   └─────────────┘   └─────────────┘    └─────────────┘
```

---

## 👥 Five Dedicated Role Workspaces

KENKO-AI delivers dedicated, purpose-built interfaces tailored to each healthcare stakeholder:

```
                                 KENKO-AI PLATFORM
                                         │
     ┌───────────────┬───────────────────┼───────────────────┬───────────────┐
     │               │                   │                   │               │
     ▼               ▼                   ▼                   ▼               ▼
┌──────────┐   ┌───────────┐       ┌───────────┐       ┌───────────┐   ┌───────────┐
│  Doctor  │   │  Patient  │       │ Diagnostic│       │ Pharmacy  │   │  System   │
│Workspace │   │ Workspace │       │Lab Portal │       │ Workspace │   │   Admin   │
└──────────┘   └───────────┘       └───────────┘       └───────────┘   └───────────┘
```

| Workspace | URL Path | Target User | Key Capabilities & Features |
|---|---|---|---|
| **Doctor Workspace** | `/doctor` | General Physicians, Specialists | Live ambient voice recording, video telehealth room, AI extraction review, inline editor, one-click finalization, patient history drawer. |
| **Patient Workspace** | `/patient` | Patients, Family Caregivers | Plain-language visit summaries, interactive medication schedule, upcoming follow-up countdown, grounded consultation Q&A chatbot. |
| **Lab Workspace** | `/lab` | Pathologists, Lab Technicians | Specimen collection queue, STAT/Urgent priority tags, test result entry, diagnostic PDF/image report upload. |
| **Pharmacy Workspace** | `/pharmacy` | Hospital Pharmacists, Dispensary | Digital prescription verification, dosage & frequency checks, medication dispensing sign-off, OCR prescription ingestion. |
| **Admin Workspace** | `/admin` | Hospital Admins, Clinical Leads | System utilization metrics, active session monitors, user role management, system audit trail viewer, AI model health diagnostics. |

---

## 🔬 Core Clinical Modules

### 1. Multilingual Speech-to-Text & Diarization
- **Engine**: `faster-whisper` backed by CTranslate2.
- **Language Detection**: Automatically determines language probabilities per audio stream (English, Tamil, and Tamil-English code-switching).
- **Speaker Diarization**: Separates audio into distinct conversational turns for `Doctor` and `Patient`, tagging each phrase with precise start/end timestamps and confidence scores.
- **Audio Persistence**: Audio files are safely stored in `backend/uploads/consultations/` with secure UUID filenames.

### 2. Zero-Hallucination Clinical Extraction
- **Engine**: Ollama REST API with prompt engineering tailored for medical safety.
- **Extraction Schema**:
  - `chief_complaint`: Primary symptom or reason for visit.
  - `symptoms`: List of items with name, duration, exact transcript quote, and uncertainty flag.
  - `vitals`: Blood Pressure, Heart Rate, SpO2, Temperature, Respiratory Rate, Body Weight.
  - `history`: Chronic conditions, known drug allergies, surgical history.
  - `medications`: Drug name, dosage (e.g., 500mg), frequency (`1-0-1`), duration (`5 days`), administration route (`Oral`), meal relation (`After food`), and transcript quote.
  - `investigations`: Ordered diagnostic tests with clinical justification.
  - `follow_up`: Target timeframe, explicit date, and required clinical milestone.
  - `uncertainty_flags`: Highlights ambiguous or conflicting patient statements for clinician attention.

### 3. Doctor Review, Live Editing & Versioned Audit
- **In-Browser Medical Editor**: Physicians can click any field to edit dosages, alter diagnostic test choices, add cautionary instructions, or adjust follow-up dates.
- **Version Tracking**: Every change creates a new versioned summary record (`version: 1 -> version: 2`) preserving historical AI drafts for medicolegal traceability.
- **Approval Stamp**: Records `is_doctor_approved = True`, `approved_by`, and an immutable timestamp.

### 4. Central Multidisciplinary Care Routing
When a doctor signs off on a consultation, `backend/app/services/router.py` executes an atomic database transaction that generates actionable tasks across hospital systems:
- Creates individual `FollowUp` entries with target completion dates.
- Generates `LabTask` orders assigned to the pathology dashboard.
- Schedules `NursingTask` items for inpatient vitals checks.
- Synchronizes `Medication` records to the pharmacy dispensing queue.
- Publishes the validated `patient_view` summary to the patient's mobile portal.

### 5. Follow-Up Intelligence & SLA Engine
- Tracks each follow-up commitment through a strict clinical lifecycle:
  1. `PENDING_DOCTOR_CONFIRMATION` (AI suggested during transcription)
  2. `CONFIRMED` (Clinician validated during consultation sign-off)
  3. `REMINDER_SCHEDULED` (Queued for SMS / notification dispatch)
  4. `COMPLETED` (Patient attended or investigation completed)
  5. `CANCELLED` (Clinician adjusted treatment plan)
- **SLA Urgency Badges**:
  - 🟢 **Upcoming**: Due in > 1 day.
  - 🟡 **Due Today**: Action required within the current calendar date.
  - 🔴 **Overdue**: Past due date without recorded completion.

### 6. Prescription Studio & Medical OCR
- **Dual-Engine OCR**:
  - **Google Gemini 1.5 / 2.0 Vision API**: Industry-leading deciphering of doctor handwriting and complex layout parsing.
  - **PaddleOCR (Local Fallback)**: Runs 100% offline on CPU/GPU for printed clinical documents without external internet access.
- **Entity Extraction**: Normalizes extracted prescription text into structured medication rows with automatic calculation of daily dosages and course durations.

### 7. Patient Care Timeline & Grounded Q&A Chatbot
- **Dynamic Chronological Feed**: Visualizes past appointments, laboratory findings, active prescription regimens, and doctor instructions.
- **Grounded Consultation Q&A Chatbot**:
  - Uses RAG (Retrieval-Augmented Generation) constrained strictly to the consultation's verified transcript and signed summary.
  - **Anti-Hallucination Guardrails**: If a patient asks about symptoms or conditions not mentioned during their visit, the bot responds: *"This was not discussed during your consultation. Please contact your doctor for advice on new symptoms."*

---

## 💻 Technology Stack

| Layer | Component | Details |
|---|---|---|
| **Frontend UI** | React 19 + Vite | High-performance SPA with fast HMR |
| **Styling & UI Tokens** | Tailwind CSS + Custom CSS | Glassmorphism, dark/light themes, accessible clinical typography |
| **Icons & Media** | Lucide React | Modern medical and operational iconography |
| **API Client** | Axios & Native Fetch | JWT interceptors, auto-header injection, error handling |
| **Backend API** | FastAPI + Uvicorn | Asynchronous Python 3.10+ REST API with OpenAPI Swagger docs |
| **ORM & Database** | SQLAlchemy 2.0 + SQLite | Relational schema with foreign key cascades and indexed queries |
| **Validation** | Pydantic v2 | Strict request/response payload validation and serialization |
| **Speech Recognition** | `faster-whisper` | CTranslate2-accelerated OpenAI Whisper (small/medium/large-v3) |
| **Local LLM Engine** | Ollama | Local inference via REST (`qwen2.5:7b`, `llama3.2:3b`, `mistral:7b`) |
| **Medical OCR** | Google Vision / PaddleOCR | Multimodal image understanding + local OCR fallback |
| **Authentication** | PyJWT + Passlib | PBKDF2 HMAC-SHA256 password hashing & bearer tokens |
| **Testing** | Pytest + HTTPX | End-to-end integration and endpoint validation suite |

---

## 📁 Repository Structure

```
KENKO-AI/
├── backend/
│   ├── app/
│   │   ├── db/
│   │   │   └── database.py           # SQLite connection pool, Base model, session lifecycle
│   │   ├── models/
│   │   │   ├── db_models.py          # SQLAlchemy ORM models (User, Consultation, FollowUp, etc.)
│   │   │   └── schemas.py            # Pydantic v2 request & response validation schemas
│   │   ├── routes/
│   │   │   ├── auth_routes.py        # Authentication (/auth/register, /auth/login, /auth/me)
│   │   │   ├── consultations.py      # Consultation creation, STT, AI extraction, chat Q&A
│   │   │   ├── followups.py          # Follow-up intelligence state-machine and metrics
│   │   │   ├── ocr.py                # Document OCR extraction endpoint
│   │   │   ├── prescriptions.py      # Prescription upload, entity parsing, verification
│   │   │   ├── role_dashboards.py    # Doctor, Patient, Nurse, Lab, Pharmacy, Admin portals
│   │   │   └── demo.py               # Pre-seeded multilingual synthetic clinical scenarios
│   │   ├── services/
│   │   │   ├── ai_service.py         # Ollama LLM clinical prompt engineering & Q&A RAG
│   │   │   ├── speech.py             # faster-whisper transcription and speaker diarization
│   │   │   ├── router.py             # Multidisciplinary care task routing engine
│   │   │   ├── google_vision_ocr.py  # Google Gemini Vision OCR integration
│   │   │   ├── paddle_ocr.py         # Local PaddleOCR offline pipeline
│   │   │   ├── prescription_parser.py# Medical regex & heuristic entity normalizer
│   │   │   └── audit.py              # System audit trail logger
│   │   ├── utils/
│   │   │   ├── auth.py               # Password hashing, JWT token creation and verification
│   │   │   └── image_validation.py   # MIME type, extension, and file size checks
│   │   └── main.py                   # FastAPI initialization, CORS, lifespan, router mounts
│   ├── tests/
│   │   └── test_medibridge_integration.py # Automated end-to-end integration test suite
│   ├── uploads/                      # Local storage for consultation audio and lab attachments
│   ├── requirements.txt              # Backend Python dependencies
│   └── .env.example                  # Environment configuration template
│
├── src/
│   ├── components/                   # Reusable UI components (AudioRecorder, Navbar, Sidebar, etc.)
│   ├── context/                      # AuthContext, RoleContext, ThemeContext, ToastContext
│   ├── layouts/
│   │   └── AppLayout.jsx             # Responsive multi-role application frame
│   ├── pages/
│   │   ├── admin/AdminWorkspace.jsx  # System administration, user roles, audit viewer
│   │   ├── doctor/DoctorWorkspace.jsx# Doctor patient queue and visit dashboard
│   │   ├── patient/PatientWorkspace.jsx # Patient care timeline and grounded Q&A chatbot
│   │   ├── lab/LabWorkspace.jsx      # Diagnostic specimen and test results manager
│   │   ├── pharmacy/PharmacyWorkspace.jsx # Prescription verification and dispensing studio
│   │   ├── ConsultationWorkspacePage.jsx # Ambient clinical voice review and inline editor
│   │   ├── VideoConsultationPage.jsx # Telehealth video room with live side-by-side notes
│   │   ├── InPersonConsultationPage.jsx # In-person ambient microphone recording studio
│   │   ├── ConsultationsHubPage.jsx  # All consultations index and filtering
│   │   ├── PrescriptionStudioPage.jsx# OCR prescription scanner and entity editor
│   │   ├── FollowUpHubPage.jsx       # Follow-up intelligence lifecycle dashboard
│   │   ├── OCRPage.jsx               # Medical document text extractor
│   │   ├── DemoPage.jsx              # 1-click synthetic demo scenario launcher
│   │   ├── LoginPage.jsx & RegisterPage.jsx
│   │   └── auth/RoleLoginPage.jsx    # Dedicated login entrypoints per role
│   ├── services/
│   │   └── api.js                    # Central Axios API client with JWT interceptors
│   ├── index.css                     # Design tokens, typography, glassmorphism utilities
│   ├── App.jsx                       # Route hierarchy and role guards
│   └── main.jsx                      # Vite React root
│
├── package.json                      # Frontend dependencies and scripts
└── README.md                         # Technical documentation and setup guide
```

---

## 🚀 Quick Start & Installation Guide

### 1. Prerequisites
Ensure the following tools are installed on your host system:
* **Node.js**: v18.0 or newer (v20+ recommended)
* **Python**: v3.10 to v3.12
* **Ollama**: Download from [ollama.com](https://ollama.com)
* **Git**: [git-scm.com](https://git-scm.com)

---

### 2. Ollama Local LLM Setup
Start the Ollama daemon and pull the recommended open-source model:

```bash
# Recommended: Qwen 2.5 (7B) - High precision JSON extraction & multilingual medical understanding
ollama pull qwen2.5:7b

# Lightweight alternative for lower RAM/VRAM machines (e.g. 8GB RAM laptops):
ollama pull llama3.2:3b
```

Verify Ollama is active by visiting `http://localhost:11434` in your browser.

---

### 3. Backend Installation

1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create a dedicated Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Create your local environment file:
   ```bash
   # Copy sample configuration
   cp .env.example .env
   ```

5. Launch the FastAPI development server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

The backend server is now running at **http://localhost:8000**.  
Interactive Swagger API documentation is available at **http://localhost:8000/docs**.

---

### 4. Frontend Installation

1. Open a new terminal window at the project root (`KENKO-AI/`):
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to **http://localhost:5173**.

---

## ⚙️ Environment Configuration Reference

Edit `backend/.env` to configure system behavior:

| Variable | Default Value | Description |
|---|---|---|
| `APP_ENV` | `development` | Environment mode (`development` / `production`). |
| `APP_HOST` | `0.0.0.0` | Backend bind host address. |
| `APP_PORT` | `8000` | Backend HTTP listening port. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated CORS allowed frontend URLs. |
| `JWT_SECRET` | `medibridge_super_secret_jwt_key...` | Cryptographic secret key for signing JWT tokens. |
| `JWT_ALGORITHM` | `HS256` | JWT signature algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| `1440` (24 Hours) | JWT session validity duration. |
| `OLLAMA_URL` | `http://localhost:11434` | URL of the local Ollama LLM REST service. |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Ollama model identifier (`qwen2.5:7b`, `llama3.2:3b`, `mistral:7b`). |
| `WHISPER_MODEL` | `small` | `faster-whisper` model size (`tiny`, `base`, `small`, `medium`, `large-v3`). |
| `DATABASE_URL` | `sqlite:///./kenko_clinical.db` | SQLAlchemy database connection URI. |
| `OCR_LANG` | `en` | Default OCR language recognition code. |
| `OCR_USE_GPU` | `false` | Enable GPU CUDA acceleration for PaddleOCR when available. |
| `OCR_MAX_FILE_SIZE_MB` | `10` | Maximum allowed image upload size in megabytes. |
| `HF_TOKEN` | *(Optional)* | Hugging Face user access token (only for pyannote diarization). |

---

## 🔐 Default Demo Accounts & RBAC Roles

The system automatically initializes default user accounts with pre-seeded demo records on first startup:

| Role | Email Address | Password | Dedicated Route | Primary Workflow |
|---|---|---|---|---|
| **Doctor** | `doctor@medibridge.ai` | `Doctor123!` | `/doctor` | Voice capture, AI extraction review, prescription generation, sign-off. |
| **Patient** | `patient@medibridge.ai` | `Patient123!` | `/patient` | Dynamic care timeline, medication schedules, grounded Q&A chatbot. |
| **Pharmacist** | `pharmacy@medibridge.ai` | `Pharmacy123!` | `/pharmacy` | Digital prescription verification, dosage inspection, drug dispensing. |
| **Lab Tech** | `lab@medibridge.ai` | `LabTech123!` | `/lab` | Specimen collection, STAT/Urgent queue, diagnostic test result entry. |
| **Admin** | `admin@medibridge.ai` | `Admin123!` | `/admin` | Hospital metrics, audit log inspection, user role management. |

> 💡 *You can also create new custom accounts anytime using the `/register` page.*

---

## 📡 REST API Endpoint Reference

### Authentication (`/auth`)
* `POST /auth/register` — Register a new user with role assignment (`PATIENT`, `DOCTOR`, `ADMIN`, `NURSE`, `LAB`, `PHARMACIST`).
* `POST /auth/login` — Authenticate user and receive a JWT Bearer token.
* `GET /auth/me` — Retrieve the authenticated profile and linked patient/doctor identifiers.

### Clinical Consultations (`/consultations`)
* `POST /consultations` — Create a new consultation session (In-Person or Video).
* `POST /consultations/{id}/upload-audio` — Upload audio recording (`.wav`, `.mp3`, `.m4a`, `.webm`) for transcription.
* `POST /consultations/{id}/process-speech` — Run `faster-whisper` STT and speaker diarization.
* `POST /consultations/{id}/summarize` — Execute Ollama LLM extraction to generate structured clinical facts.
* `PUT /consultations/{id}/finalize` — Doctor review and approval; triggers central multidisciplinary routing.
* `POST /consultations/{id}/chat` — Grounded patient consultation Q&A chatbot.
* `GET /consultations/{id}` — Retrieve full consultation record with transcript segments, versioned summaries, and tasks.
* `GET /consultations` — List consultations with search, role-based filters, and status pagination.
* `DELETE /consultations/{id}` — Remove a consultation and related records.

### Prescription Studio & Medical OCR (`/prescriptions` & `/ocr`)
* `POST /ocr/extract` — Extract raw text from medical document image using Google Gemini Vision or PaddleOCR.
* `POST /prescriptions/upload-and-parse` — Ingest prescription image and return parsed medication entities.
* `GET /prescriptions` — Retrieve all processed prescriptions.
* `PUT /prescriptions/{id}/verify` — Mark prescription as clinically verified by a pharmacist or physician.

### Follow-Up Intelligence (`/followups`)
* `GET /followups` — Query follow-ups with filters (`patient_id`, `status`, `urgency`, `category`).
* `GET /followups/stats` — Retrieve aggregated follow-up metrics and SLA breakdown.
* `PATCH /followups/{id}/status` — Transition follow-up status (`CONFIRMED`, `REMINDER_SCHEDULED`, `COMPLETED`, `CANCELLED`).
* `PATCH /followups/{id}/reschedule` — Update follow-up target due date and reason.

### Role Portals (`/role-dashboards`)
* `GET /role-dashboards/doctor` — Doctor overview (pending reviews, active patients, recent consultations).
* `GET /role-dashboards/patient/{patient_id}/timeline` — Chronological clinical timeline for a patient.
* `GET /role-dashboards/lab` — Lab technician active queue, pending collections, completed tests.
* `POST /role-dashboards/lab/{task_id}/result` — Upload or enter lab results for an order.
* `GET /role-dashboards/pharmacy` — Pharmacy prescription dispensing queue.
* `GET /role-dashboards/admin` — Hospital system analytics, active sessions, and audit log history.

### Synthetic Demo Engine (`/demo`)
* `POST /demo/seed` — Seed realistic multi-language clinical scenarios (English, Tamil, Mixed, OCR).
* `POST /demo/reset` — Reset database to pristine state for presentations.

---

## 🧪 Automated Testing & Quality Assurance

KENKO-AI includes an automated integration and regression test suite verifying all critical clinical workflows:

```bash
# Activate your backend virtual environment
cd backend
source venv/bin/activate  # Or .\venv\Scripts\Activate.ps1 on Windows

# Run full integration test suite with verbose output
python -m pytest tests/test_medibridge_integration.py -v
```

### What the Test Suite Validates:
1. User registration, password hashing security, and JWT token issuance.
2. Multilingual audio upload handling and transcription pipeline.
3. Ollama structured fact extraction and fallback mechanisms.
4. Doctor inline editing and atomic finalization routing.
5. Follow-up state machine transitions and SLA overdue calculations.
6. Grounded patient chatbot compliance (answering known facts and rejecting unmentioned medical queries).
7. Prescription OCR parsing and entity normalization.

---

## ⚖️ Clinical Safety, Privacy & HIPAA Posture

1. **Air-Gapped & Local Inference Capability**:
   - Zero clinical transcripts or audio recordings are transmitted to public cloud LLMs by default.
   - All AI summarization executes via local Ollama models (`qwen2.5:7b` / `llama3.2:3b`).
2. **Clinician-in-the-Loop Governance**:
   - AI outputs are strictly treated as drafts (`PENDING_DOCTOR_CONFIRMATION`).
   - No prescription, lab requisition, or follow-up is dispatched without explicit physician review and cryptographic sign-off.
3. **Anti-Hallucination Grounding**:
   - The patient consultation chatbot operates under strict deterministic system prompts that prevent speculative diagnoses or medical advice not present in the signed clinical record.
4. **Immutable Audit Logging**:
   - All record accesses, doctor edits, status transitions, and report exports are timestamped in the `audit_logs` database table.

---

## ❓ Troubleshooting & FAQ

#### Q1: Ollama extraction fails or times out.
* **Resolution**: Ensure the Ollama service is running (`ollama serve`). Confirm you have pulled the configured model (`ollama pull qwen2.5:7b`). Check `OLLAMA_URL` in `backend/.env` points to `http://localhost:11434`.

#### Q2: Whisper transcription is slow on CPU.
* **Resolution**: In `backend/.env`, set `WHISPER_MODEL=small` or `WHISPER_MODEL=base` for faster execution on non-GPU machines. If you have an NVIDIA GPU with CUDA, install PyTorch with CUDA support.

#### Q3: How do I test the Tamil or mixed-language audio transcription?
* **Resolution**: Open the **Demo Mode** (`/demo`) in the web application and click *"Tamil Diabetes Follow-Up"* or *"Tanglish Pediatric Visit"*. These pre-seeded scenarios include exact audio recordings and verified multilingual transcriptions.

#### Q4: How do I enable Google Gemini AI Vision for handwritten prescriptions?
* **Resolution**: Pass your Google AI API key via the UI settings modal or set `GOOGLE_API_KEY=your_key_here` in `backend/.env`. If omitted, the system seamlessly falls back to the local PaddleOCR engine.

---

## 📄 License & Attribution

KENKO-AI (MediBridge AI) is distributed under the **MIT License**.  
Built with open-source contributions from the **FastAPI**, **React**, **faster-whisper**, and **Ollama** communities.
