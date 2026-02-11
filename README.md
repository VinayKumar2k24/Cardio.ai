# CardioAI - Heart Disease Prediction System

CardioAI is a professional, AI-powered heart disease prediction engine designed to provide accurate clinical insights using advanced machine learning. It features a modern, responsive interface and provides patient-friendly, plain English explanations for every prediction.

## 🚀 Key Features

- **AI-Driven Predictions**: Utilizes a Random Forest model trained in Orange Data Mining for high accuracy.
- **Explainable AI (XAI)**: Provides clear, plain English justifications for results instead of technical jargon.
- **Batch Processing**: Supports CSV uploads to analyze multiple patients at once.
- **Manual Metrics**: Easy-to-use forms for manual clinical data entry.
- **Multilingual Support**: Available in English, Hindi, and Kannada.
- **Modern UI**: A premium, dark-themed interface built with TailwindCSS and glassmorphism aesthetics.

## 🛠️ Tech Stack

- **Frontend**: HTML5, TailwindCSS, JavaScript (ES6)
- **Backend**: Node.js, Express
- **AI/ML Engine**: Python, Orange Data Mining (Orange3)
- **Database**: MySQL
- **Communication**: Nodemailer for clinical reports

## 📦 Setup & Installation

### Prerequisites
- Node.js (v14+)
- Python (3.8+)
- MySQL Server

### 1. Clone the Repository
```bash
git clone https://github.com/VinayKumar2k24/HealthCare.git
cd HealthCare
```

### 2. Install Dependencies
```bash
npm install
python -m pip install Orange3 numpy
```

### 3. Environment Configuration
Create a `.env` file in the root directory with the following:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=healthcare
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 4. Database Setup
```bash
node setup-db.js
```

### 5. Run the Application
```bash
npm start
```

## 📄 License
This project is licensed under the MIT License.
