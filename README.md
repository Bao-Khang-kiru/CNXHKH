# 📚 CNXHKH Quiz App

Ứng dụng ôn tập trắc nghiệm môn **Chủ nghĩa xã hội khoa học** với 202 câu hỏi, 7 chương, hỗ trợ AI giải thích và Bảng xếp hạng.

## Tính năng

| Chế độ | Mô tả |
|--------|-------|
| 📚 **Học theo Chương** | Ôn từng chương 1-7 |
| 📝 **Thi thử** | 40 câu ngẫu nhiên, giới hạn 45 phút |
| ☠️ **Tử địa** | Ôn lại câu sai, tốt nghiệp sau 3 lần đúng |
| ⚡ **Sinh tồn** | Sai 1 câu là Game Over! |
| 🔍 **Soi từ khóa** | Highlight từ khóa quan trọng |
| 🤖 **AI giải thích** | Gemini AI giải thích tại sao sai |
| 💬 **Chatbot** | Hỏi đáp tự do về CNXHKH |
| 🏆 **Bảng xếp hạng** | Top 20 điểm cao nhất (cần Firebase) |

## Cấu trúc

```
web-app/
├── index.html          # Trang chủ
├── quiz.html           # Màn hình làm bài
├── results.html        # Kết quả
├── leaderboard.html    # Bảng xếp hạng
├── profile.html        # Hồ sơ cá nhân
├── css/style.css       # Stylesheet
├── js/
│   ├── app.js          # Auth, mistake bank, utils
│   ├── data.js         # Load & filter questions
│   ├── quiz.js         # Logic làm bài
│   ├── firebase.js     # Firebase config + helpers
│   └── ai.js           # Gemini API
├── questions.json      # 202 câu trắc nghiệm
└── parse_questions.py  # Script parse từ .md
```

---

## ⚙️ Thiết lập

### 1. Gemini API Key (Cơ chế BYOK - An toàn tuyệt đối cho Public Repo)

Dự án áp dụng mô hình **BYOK (Bring Your Own Key)**:
- **Không có bất kỳ API key nào được hardcode trong mã nguồn**. Bạn có thể yên tâm **Public repo** lên GitHub.
- Người dùng (bạn và bạn bè) chỉ cần bấm vào nút **`⚙️ API Key`** ở góc trên thanh điều hướng để dán key một lần duy nhất.
- Key được lưu trong `localStorage` của chính trình duyệt người dùng, **không bao giờ bị gửi lên GitHub hay bất kỳ server nào**.
- Lấy Gemini API key miễn phí tại: https://aistudio.google.com/app/apikey (chỉ mất 10 giây).

---

### 2. Firebase (Tùy chọn – cần cho Bảng xếp hạng & Đăng nhập)

#### Bước 1: Tạo project Firebase

1. Vào https://console.firebase.google.com/
2. Tạo project mới (hoặc dùng project có sẵn)
3. Bật **Authentication** → Sign-in method → **Google**
4. Bật **Firestore Database** (chế độ test hoặc production)

#### Bước 2: Lấy Firebase Config

1. Project Settings → Your apps → Web app → Add app
2. Copy `firebaseConfig` object

#### Bước 3: Điền vào `js/firebase.js`

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

#### Bước 4: Firestore Rules

Trong Firestore → Rules, dán:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Results are private to each user
    match /results/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Leaderboard: authenticated users can read all, write their own
    match /leaderboard/{mode}/scores/{scoreId} {
      allow read: if true;
      allow create: if request.auth != null;
    }
  }
}
```

---

### 3. Deploy lên GitHub Pages

#### Cách 1: Drag & Drop (nhanh nhất)

1. Tạo repo mới trên GitHub
2. Upload toàn bộ thư mục `web-app/` lên repo
3. Settings → Pages → Branch: `main` → Save
4. Truy cập: `https://username.github.io/repo-name/`

#### Cách 2: Git CLI

```bash
cd web-app
git init
git add .
git commit -m "Initial CNXHKH quiz app"
git remote add origin https://github.com/username/cnxhkh-quiz.git
git push -u origin main
```

Sau đó vào Settings → Pages → Deploy from branch → main.

> **Lưu ý**: GitHub Pages phục vụ file tĩnh, không cần server backend. Firebase và Gemini được gọi trực tiếp từ browser.

---

## 🎮 Phím tắt trong Quiz

| Phím | Chức năng |
|------|-----------|
| `1` / `A` | Chọn đáp án A |
| `2` / `B` | Chọn đáp án B |
| `3` / `C` | Chọn đáp án C |
| `4` / `D` | Chọn đáp án D |
| `Space` / `→` | Câu tiếp theo |

---

## 📊 Dữ liệu câu hỏi

| Chương | Chủ đề | Số câu |
|--------|--------|--------|
| 1 | Nhập môn CNXHKH | 32 |
| 2 | Sứ mệnh lịch sử giai cấp công nhân | 35 |
| 3 | CNXH và thời kỳ quá độ | 32 |
| 4 | Dân chủ XHCN và nhà nước XHCN | 28 |
| 5 | Cơ cấu xã hội - giai cấp | 25 |
| 6 | Vấn đề dân tộc và tôn giáo | 33 |
| 7 | Vấn đề gia đình | 17 |
| **Tổng** | | **202** |

---

## 🛠️ Cập nhật câu hỏi

Nếu muốn thêm/sửa câu hỏi, chỉnh file nguồn `.md` rồi chạy:

```bash
python parse_questions.py
```

Script sẽ tái tạo `questions.json` từ file Markdown.

---

## 🔒 Lưu ý bảo mật & Triển khai Public

- **Gemini API Key**: Đã chuyển sang mô hình BYOK (lưu an toàn trong `localStorage` của trình duyệt cá nhân). Kho mã nguồn (Repository) **hoàn toàn có thể đặt ở chế độ Public** để bật GitHub Pages miễn phí mà không lo bị lộ key.
- **Firebase Config**: Firebase client keys là public identifier và an toàn khi đặt trong repo công khai, miễn là bạn cấu hình Firestore Rules hợp lý (chỉ cho phép user ghi đè điểm của chính họ).
