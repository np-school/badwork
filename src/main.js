import "./style.css";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import {
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  Plus,
  GraduationCap,
  Users,
  ChevronRight,
  X,
  FileText,
  BarChart3
} from "lucide";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let auth = null;
let db = null;
let unsubscribeCourses = null;
let currentUser = null;
let courses = [];

if (firebaseConfigured) {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

const app = document.querySelector("#app");
const savedCollapsed = localStorage.getItem("teacher-score-sidebar") === "collapsed";
let sidebarCollapsed = savedCollapsed;

function icon(name, size = 20) {
  const icons = {
    dashboard: LayoutDashboard,
    courses: BookOpen,
    settings: Settings,
    logout: LogOut,
    menu: Menu,
    plus: Plus,
    school: GraduationCap,
    users: Users,
    arrow: ChevronRight,
    close: X,
    assignment: FileText,
    report: BarChart3
  };
  const Icon = icons[name];
  return Icon ? Icon.toSvg({ width: size, height: size, "stroke-width": 1.8 }) : "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="brand-mark">${icon("school", 28)}</div>
        <h1>Teacher Score</h1>
        <p class="muted">ระบบบันทึกคะแนนส่วนตัวสำหรับครู</p>

        <button id="google-login" class="google-btn" ${!firebaseConfigured ? "disabled" : ""}>
          <span class="google-logo">G</span>
          เข้าสู่ระบบด้วย Google
        </button>

        ${
          !firebaseConfigured
            ? `<div class="setup-warning">
                 <strong>ยังไม่ได้ตั้งค่า Firebase</strong>
                 <span>คัดลอกไฟล์ <code>.env.example</code> เป็น <code>.env</code> แล้วใส่ Firebase Config</span>
               </div>`
            : ""
        }
      </section>
    </main>
  `;

  document.querySelector("#google-login")?.addEventListener("click", loginWithGoogle);
}

async function loginWithGoogle() {
  if (!auth) return;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    alert(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
  }
}

async function logout() {
  if (auth) await signOut(auth);
}

function renderApp() {
  app.innerHTML = `
    <div class="shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}" id="shell">
      <aside class="sidebar">
        <div class="sidebar-head">
          <div class="brand">
            <div class="brand-icon">${icon("school", 21)}</div>
            <span class="brand-name">Teacher Score</span>
          </div>
          <button class="icon-btn collapse-btn" id="toggle-sidebar" title="ย่อ/ขยายเมนู">
            ${icon("menu", 20)}
          </button>
        </div>

        <nav class="nav">
          <a class="nav-item active" href="#" data-page="dashboard" title="หน้าหลัก">
            ${icon("dashboard")} <span>หน้าหลัก</span>
          </a>
          <a class="nav-item" href="#" data-page="courses" title="รายวิชาของฉัน">
            ${icon("courses")} <span>รายวิชาของฉัน</span>
          </a>
          <a class="nav-item" href="#" data-page="settings" title="ตั้งค่า">
            ${icon("settings")} <span>ตั้งค่า</span>
          </a>
        </nav>

        <div class="sidebar-bottom">
          <div class="user-mini">
            <img src="${escapeHtml(currentUser?.photoURL || "")}" alt="" />
            <div class="user-text">
              <strong>${escapeHtml(currentUser?.displayName || "ผู้ใช้")}</strong>
              <span>${escapeHtml(currentUser?.email || "")}</span>
            </div>
          </div>
          <button class="nav-item logout-btn" id="logout" title="ออกจากระบบ">
            ${icon("logout")} <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <div class="eyebrow">ระบบบันทึกคะแนน</div>
            <h2 id="page-title">หน้าหลัก</h2>
          </div>
          <div class="topbar-actions">
            <span class="academic-pill">ปีการศึกษา 2569</span>
            <button class="avatar-btn" id="profile-btn" title="บัญชี Google">
              <img src="${escapeHtml(currentUser?.photoURL || "")}" alt="" />
            </button>
          </div>
        </header>

        <section id="page-content" class="page-content"></section>
      </main>
    </div>

    <div id="modal-root"></div>
  `;

  bindShellEvents();
  renderDashboard();
  subscribeCourses();
}

function bindShellEvents() {
  document.querySelector("#toggle-sidebar").addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem(
      "teacher-score-sidebar",
      sidebarCollapsed ? "collapsed" : "expanded"
    );
    document.querySelector("#shell").classList.toggle("sidebar-collapsed", sidebarCollapsed);
  });

  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const page = item.dataset.page;

      document.querySelectorAll(".nav-item[data-page]").forEach((nav) => {
        nav.classList.toggle("active", nav.dataset.page === page);
      });

      if (page === "dashboard") {
        document.querySelector("#page-title").textContent = "หน้าหลัก";
        renderDashboard();
      } else if (page === "courses") {
        document.querySelector("#page-title").textContent = "รายวิชาของฉัน";
        renderCourses();
      } else {
        document.querySelector("#page-title").textContent = "ตั้งค่า";
        renderSettings();
      }
    });
  });

  document.querySelector("#logout").addEventListener("click", logout);
}

function subscribeCourses() {
  if (!db || !currentUser) return;

  if (unsubscribeCourses) unsubscribeCourses();

  const ref = collection(db, "users", currentUser.uid, "courses");
  const q = query(ref, orderBy("createdAt", "desc"));

  unsubscribeCourses = onSnapshot(
    q,
    (snapshot) => {
      courses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const activePage = document.querySelector(".nav-item.active")?.dataset.page;
      if (activePage === "courses") renderCourses();
      else renderDashboard();
    },
    (error) => {
      console.error("Firestore:", error);
      courses = [];
      renderDashboard(`<div class="error-box">อ่านข้อมูลรายวิชาไม่ได้ กรุณาตรวจสอบ Firestore Security Rules</div>`);
    }
  );
}

function renderDashboard(extra = "") {
  const content = document.querySelector("#page-content");
  if (!content) return;

  const roomCount = courses.reduce((sum, c) => sum + (c.rooms?.length || 0), 0);

  content.innerHTML = `
    ${extra}
    <div class="welcome-row">
      <div>
        <h3>สวัสดีครับ ${escapeHtml(currentUser?.displayName || "คุณครู")} 👋</h3>
        <p>จัดการรายวิชา ห้องเรียน และคะแนนของคุณได้จากที่นี่</p>
      </div>
      <button class="primary-btn" id="add-course">${icon("plus", 18)} สร้างรายวิชา</button>
    </div>

    <div class="stats-grid">
      <article class="stat-card">
        <div class="stat-icon teal">${icon("courses", 21)}</div>
        <div><span>รายวิชา</span><strong>${courses.length}</strong></div>
      </article>
      <article class="stat-card">
        <div class="stat-icon blue">${icon("school", 21)}</div>
        <div><span>ห้องเรียน</span><strong>${roomCount}</strong></div>
      </article>
      <article class="stat-card">
        <div class="stat-icon green">${icon("users", 21)}</div>
        <div><span>นักเรียน</span><strong>—</strong></div>
      </article>
    </div>

    <div class="section-head">
      <div>
        <h3>รายวิชาของฉัน</h3>
        <p>งานที่สร้างในรายวิชาจะใช้ร่วมกันทุกห้อง</p>
      </div>
      <button class="text-btn" id="view-courses">ดูทั้งหมด ${icon("arrow", 16)}</button>
    </div>

    ${
      courses.length
        ? `<div class="course-grid">${courses.slice(0, 6).map(courseCard).join("")}</div>`
        : emptyCourses()
    }
  `;

  document.querySelector("#add-course")?.addEventListener("click", openCourseModal);
  document.querySelector("#view-courses")?.addEventListener("click", () => {
    document.querySelector('[data-page="courses"]').click();
  });
  bindCourseCards();
}

function emptyCourses() {
  return `
    <div class="empty-card">
      <div class="empty-icon">${icon("courses", 26)}</div>
      <h3>ยังไม่มีรายวิชา</h3>
      <p>เริ่มต้นด้วยการสร้างรายวิชาแรกของคุณ</p>
      <button class="primary-btn" id="empty-add-course">${icon("plus", 18)} สร้างรายวิชา</button>
    </div>
  `;
}

function renderCourses() {
  const content = document.querySelector("#page-content");
  if (!content) return;

  content.innerHTML = `
    <div class="section-head page-section">
      <div>
        <h3>รายวิชาของฉัน</h3>
        <p>แต่ละรายวิชาสามารถมีหลายห้องเรียน และใช้ชุดงานร่วมกันทุกห้อง</p>
      </div>
      <button class="primary-btn" id="add-course">${icon("plus", 18)} สร้างรายวิชา</button>
    </div>

    ${
      courses.length
        ? `<div class="course-grid">${courses.map(courseCard).join("")}</div>`
        : emptyCourses()
    }
  `;

  document.querySelector("#add-course")?.addEventListener("click", openCourseModal);
  document.querySelector("#empty-add-course")?.addEventListener("click", openCourseModal);
  bindCourseCards();
}

function courseCard(course) {
  const rooms = Array.isArray(course.rooms) ? course.rooms : [];
  return `
    <article class="course-card" data-course-id="${escapeHtml(course.id)}">
      <div class="course-color"></div>
      <div class="course-body">
        <div class="course-top">
          <span class="subject-code">${escapeHtml(course.code || "—")}</span>
          <button class="round-arrow">${icon("arrow", 17)}</button>
        </div>
        <h3>${escapeHtml(course.name || "ไม่ระบุชื่อวิชา")}</h3>
        <p>${escapeHtml(course.level || "ไม่ระบุระดับชั้น")} · ${escapeHtml(course.term || "ภาคเรียน 1")}/${escapeHtml(course.year || "2569")}</p>

        <div class="room-row">
          ${rooms.slice(0, 6).map((room) => `<span>${escapeHtml(room)}</span>`).join("")}
          ${rooms.length > 6 ? `<span>+${rooms.length - 6}</span>` : ""}
        </div>

        <div class="course-footer">
          <span>${rooms.length} ห้อง</span>
          <span>${icon("assignment", 15)} งาน 0 รายการ</span>
        </div>
      </div>
    </article>
  `;
}

function bindCourseCards() {
  document.querySelectorAll(".course-card").forEach((card) => {
    card.addEventListener("click", () => {
      const course = courses.find((c) => c.id === card.dataset.courseId);
      if (course) openCourseDetail(course);
    });
  });
}

function openCourseModal() {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <div><h3>สร้างรายวิชา</h3><p>สร้างครั้งเดียว แล้วเพิ่มหลายห้องเรียนได้</p></div>
          <button class="icon-btn" id="close-modal">${icon("close", 20)}</button>
        </div>

        <form id="course-form">
          <div class="form-grid">
            <label>รหัสวิชา<input name="code" placeholder="เช่น ว22101" required /></label>
            <label>ชื่อรายวิชา<input name="name" placeholder="เช่น วิทยาการคำนวณ" required /></label>
            <label>ระดับชั้น
              <select name="level">
                ${["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"].map(x => `<option>${x}</option>`).join("")}
              </select>
            </label>
            <label>ภาคเรียน
              <select name="term"><option>1</option><option>2</option></select>
            </label>
            <label>ปีการศึกษา<input name="year" value="2569" required /></label>
            <label>หน่วยกิต<input name="credits" type="number" min="0" step="0.5" value="1" /></label>
          </div>

          <label class="full-label">ห้องเรียน
            <div class="room-picker">
              ${Array.from({length: 12}, (_, i) => {
                const room = `${i + 1}`;
                return `<label class="check-pill"><input type="checkbox" name="rooms" value="${room}" /><span>ห้อง ${room}</span></label>`;
              }).join("")}
            </div>
          </label>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" id="cancel-modal">ยกเลิก</button>
            <button type="submit" class="primary-btn">${icon("plus", 17)} สร้างรายวิชา</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.querySelector("#close-modal").addEventListener("click", closeModal);
  document.querySelector("#cancel-modal").addEventListener("click", closeModal);
  document.querySelector("#modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });

  document.querySelector("#course-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!db || !currentUser) return;

    const form = new FormData(e.target);
    const rooms = form.getAll("rooms").map((room) => `${form.get("level")}/${room}`);

    try {
      await addDoc(collection(db, "users", currentUser.uid, "courses"), {
        code: form.get("code").trim(),
        name: form.get("name").trim(),
        level: form.get("level"),
        term: form.get("term"),
        year: form.get("year").trim(),
        credits: Number(form.get("credits") || 0),
        rooms,
        assessments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      closeModal();
    } catch (error) {
      console.error(error);
      alert(`สร้างรายวิชาไม่สำเร็จ: ${error.message}`);
    }
  });
}

function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

function openCourseDetail(course) {
  const content = document.querySelector("#page-content");
  document.querySelector("#page-title").textContent = course.name;

  content.innerHTML = `
    <div class="breadcrumb">
      <button id="back-courses">รายวิชาของฉัน</button>
      <span>${icon("arrow", 14)}</span>
      <strong>${escapeHtml(course.code)} · ${escapeHtml(course.name)}</strong>
    </div>

    <div class="detail-hero">
      <div>
        <span class="subject-code">${escapeHtml(course.code)}</span>
        <h3>${escapeHtml(course.name)}</h3>
        <p>${escapeHtml(course.level)} · ภาคเรียน ${escapeHtml(course.term)}/${escapeHtml(course.year)}</p>
      </div>
      <button class="primary-btn">${icon("assignment", 17)} เพิ่มงาน</button>
    </div>

    <div class="tabs">
      <button class="tab active">ภาพรวม</button>
      <button class="tab">นักเรียน</button>
      <button class="tab">โครงสร้างคะแนน</button>
      <button class="tab">บันทึกคะแนน</button>
      <button class="tab">รายงาน</button>
    </div>

    <div class="section-head">
      <div><h3>ห้องเรียน</h3><p>งานของรายวิชานี้จะแสดงเหมือนกันทุกห้อง</p></div>
    </div>

    <div class="class-grid">
      ${(course.rooms || []).map((room) => `
        <button class="class-card">
          <div class="class-icon">${icon("school", 21)}</div>
          <div><strong>${escapeHtml(room)}</strong><span>นักเรียน — คน</span></div>
          <span class="class-arrow">${icon("arrow", 17)}</span>
        </button>
      `).join("") || `<div class="empty-card"><h3>ยังไม่มีห้องเรียน</h3><p>กลับไปแก้ไขรายวิชาเพื่อเพิ่มห้องเรียน</p></div>`}
    </div>
  `;

  document.querySelector("#back-courses").addEventListener("click", () => {
    document.querySelector('[data-page="courses"]').click();
  });
}

function renderSettings() {
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    <div class="settings-card">
      <div class="section-head">
        <div><h3>บัญชีผู้ใช้</h3><p>บัญชี Google ที่กำลังใช้งาน</p></div>
      </div>
      <div class="profile-row">
        <img src="${escapeHtml(currentUser?.photoURL || "")}" alt="" />
        <div><strong>${escapeHtml(currentUser?.displayName || "")}</strong><span>${escapeHtml(currentUser?.email || "")}</span></div>
      </div>
    </div>

    <div class="settings-card">
      <div class="section-head">
        <div><h3>การแสดงผล</h3><p>เมนูด้านซ้ายสามารถย่อให้เหลือเฉพาะไอคอนได้</p></div>
      </div>
      <button class="secondary-btn" id="settings-toggle">${sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"}</button>
    </div>
  `;

  document.querySelector("#settings-toggle").addEventListener("click", () => {
    document.querySelector("#toggle-sidebar").click();
    renderSettings();
  });
}

if (!firebaseConfigured) {
  renderLogin();
} else {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) renderApp();
    else renderLogin();
  });
}
