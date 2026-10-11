# 🌳 NeuroTree

### AI Adaptive Learning Platform — Transforming Documents into Interactive Knowledge Trees

🚀 **Live Demo:** https://neuro-tree.vercel.app/

NeuroTree adalah platform pembelajaran adaptif berbasis AI yang mengubah dokumen statis menjadi **knowledge graph interaktif**, membantu pengguna memahami materi secara bertahap melalui eksplorasi konsep, evaluasi pemahaman, dan rekomendasi jalur belajar.

Dengan NeuroTree, pengguna dapat mengunggah materi pembelajaran, mengeksplorasi hubungan antar konsep, mengukur pemahaman melalui quiz adaptif, serta mendapatkan rekomendasi jalur belajar berdasarkan tingkat penguasaan mereka.

---

## 🎯 Why NeuroTree?

### The Problem

Saat ini banyak proses belajar masih bergantung pada:

- Dokumen panjang yang sulit dipahami
- Materi yang sama untuk semua pengguna tanpa melihat kemampuan individu
- Evaluasi yang hanya mengukur jawaban benar/salah tanpa memahami tingkat penguasaan konsep
- Tidak adanya panduan bagaimana materi yang dipelajari berhubungan dengan tujuan karir

Banyak orang memiliki akses terhadap informasi, tetapi kesulitan mengubah informasi tersebut menjadi **pemahaman yang terstruktur**.

---

## 💡 Our Solution

NeuroTree menghadirkan pengalaman belajar baru:

**Upload → Understand → Explore → Evaluate → Master → Discover Career Path**

Dokumen tidak lagi menjadi sekadar teks, tetapi berubah menjadi:

🌳 **Knowledge Circuit**

- Materi dipecah menjadi node konsep
- Hubungan antar konsep divisualisasikan
- Pengguna dapat mengeksplorasi struktur pengetahuan

💡 **Adaptive Mastery System**

- Sistem mengukur tingkat penguasaan pengguna
- Node berubah berdasarkan progres belajar
- Konsep yang belum dikuasai dapat dipelajari kembali

🧠 **AI Generated Assessment**

- Quiz dibuat berdasarkan materi yang dipelajari
- Evaluasi tidak hanya melihat skor, tetapi perkembangan pemahaman

🚀 **Career Pathway Recommendation**

- Menghubungkan pengetahuan yang dikuasai dengan kemungkinan jalur karir

---

# ✨ Core Features

## 1. 📄 Document Intelligence (NT-01)

Mengubah dokumen pembelajaran menjadi struktur pengetahuan.

Input:

- PDF
- DOCX
- Materi pembelajaran

Output:

- Knowledge graph
- Concept nodes
- Learning pathway

---

## 2. 🧩 Knowledge Circuit Visualization

NeuroTree menggunakan pendekatan graph-based learning.

Pengguna dapat:

- Melihat hubungan antar konsep
- Memahami prerequisite antar materi
- Menentukan area yang perlu dipelajari kembali

---

## 3. 📝 Adaptive Quiz System (NT-02 / NT-03)

Quiz dibuat berdasarkan materi yang dipelajari.

Sistem mengevaluasi:

- Jawaban pengguna
- Tingkat penguasaan konsep
- Progress mastery

Mastery threshold:

```
>= 70 : Mastered
< 70  : Needs Review
```

---

## 4. 💡 Mastery Light Visualization

Progress belajar divisualisasikan melalui lampu mastery.

| Mastery | Visual          |
| ------- | --------------- |
| < 40    | Warm light      |
| 40 - 69 | Amber           |
| >= 70   | Gold / Mastered |

Visual feedback membuat pengguna memahami progres mereka secara intuitif.

---

## 5. 🚀 Career Pathway (NT-05)

NeuroTree tidak berhenti pada memahami materi.

Sistem membantu menjawab:

> "Setelah saya menguasai ini, saya bisa berkembang ke arah mana?"

Output:

- Rekomendasi jalur karir
- Hubungan skill dengan bidang profesional

---

# 🏗️ System Architecture

```
                 User
                  |
                  |
            React + Vite
              Frontend
                  |
                  |
              FastAPI
              Backend
                  |
        ---------------------
        |                   |
   SQLite Database       Langflow
                            |
                         AI Flows
                    NT-01 - NT-05
```

---

# 🤖 AI Pipeline

NeuroTree menggunakan beberapa AI workflow:

| Flow  | Function                                      |
| ----- | --------------------------------------------- |
| NT-01 | Document understanding & knowledge extraction |
| NT-02 | Quiz generation                               |
| NT-03 | Answer evaluation & mastery update            |
| NT-04 | Learning support                              |
| NT-05 | Career pathway recommendation                 |

---

# 📊 Validation & Testing

NeuroTree telah melalui pengujian:

| Test Category           | Result           |
| ----------------------- | ---------------- |
| Backend automated tests | ✅ 387/387 Passed |
| Frontend build          | ✅ Clean build    |
| Knowledge graph flow    | ✅ Verified       |
| Quiz flow               | ✅ Verified       |
| Mastery calculation     | ✅ Verified       |
| Career pathway          | ✅ Verified       |
| Production deployment   | ✅ Running        |

Deployment:

Frontend:

```
https://neuro-tree.vercel.app
```

Backend:

```
Railway Production API
```

---

# 🌟 Why This Matters

NeuroTree dibuat dengan visi:

> "Make learning adaptive, structured, and connected."

Kami percaya masa depan pendidikan bukan hanya tentang menyediakan informasi, tetapi membantu setiap orang memahami:

- Apa yang sudah mereka kuasai
- Apa yang harus mereka pelajari berikutnya
- Bagaimana pengetahuan tersebut dapat digunakan

NeuroTree mengubah pembelajaran dari:

**Passive Reading → Active Understanding**

---

# 🛠️ Technology Stack

## Frontend

- React
- Vite
- Modern UI Components

## Backend

- FastAPI
- SQLAlchemy
- SQLite

## AI Orchestration

- Langflow
- AI-powered workflows

## Deployment

- Vercel (Frontend)
- Railway (Backend)

---

# 🚀 Future Development

Potential improvements:

- Personalized learning memory
- More advanced skill assessment
- Collaborative learning trees
- Multi-user classroom mode
- Richer career intelligence

---

# 👥 Project Vision

NeuroTree is built to bridge the gap between:

**Information → Knowledge → Mastery → Opportunity**

Because learning should not only provide answers.

# 🔗 Langflow AI Infrastructure

NeuroTree menggunakan **Langflow** sebagai layer orkestrasi AI yang menghubungkan berbagai proses intelligent workflow.

Alih-alih menggunakan satu model AI untuk semua kebutuhan, NeuroTree membagi proses pembelajaran menjadi beberapa AI flow terstruktur:

```
User Input
    |
    |
 FastAPI Backend
    |
    |
 Langflow AI Layer
    |
 -------------------------
 |     |     |     |     |
NT-01 NT-02 NT-03 NT-04 NT-05
```

## Why Langflow?

Langflow memungkinkan NeuroTree untuk:

- Membuat workflow AI yang modular
- Memisahkan setiap kemampuan AI berdasarkan tujuan
- Mengembangkan flow tanpa mengubah core backend
- Melakukan eksperimen dan iterasi AI dengan lebih cepat

---

## NeuroTree AI Flows

| Flow | Purpose | Description |
|---|---|---|
| NT-01 | Knowledge Extraction | Mengubah dokumen menjadi konsep dan struktur knowledge graph |
| NT-02 | Adaptive Quiz Generation | Membuat pertanyaan berdasarkan materi dan konsep yang dipelajari |
| NT-03 | Learning Evaluation | Mengevaluasi jawaban pengguna dan menghitung perkembangan mastery |
| NT-04 | Learning Assistance | Memberikan dukungan pembelajaran berdasarkan konteks pengguna |
| NT-05 | Career Intelligence | Menghubungkan skill dan knowledge dengan rekomendasi jalur karir |

---

## Production AI Deployment

Dalam deployment production:

- Frontend berjalan di **Vercel**
- Backend API berjalan di **Railway**
- AI workflow berjalan melalui **Langflow deployment**

Architecture:

```
                User
                 |
                 |
          Vercel Frontend
                 |
                 |
          Railway FastAPI
                 |
                 |
        Langflow Production
                 |
       -------------------
       |  |  |  |  |
      NT1 NT2 NT3 NT4 NT5
                 |
                 |
          AI Model Services
```

Dengan arsitektur ini, NeuroTree memiliki pemisahan yang jelas antara:

**Interface → Application Logic → AI Reasoning Layer**

sehingga sistem lebih mudah dikembangkan, diuji, dan diperluas.

Learning should reveal the path forward.
