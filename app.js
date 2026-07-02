const KEY = "almersad-enterprise-v4";
const SESSION_KEY = "almersad-session-v4";

let txs = JSON.parse(localStorage.getItem(KEY) || "[]");
let selectedId = txs[0]?.id || null;
let currentUser = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

const $ = (id) => document.getElementById(id);

const users = {
  admin: { password: "admin123", role: "أدمن" },
  user: { password: "user123", role: "مستخدم" }
};

const titles = {
  login: ["الدخول", "سجل الدخول للمتابعة"],
  user: ["إرسال معاملة", "واجهة المستخدم لإرسال معاملات جديدة"],
  admin: ["لوحة الأدمن", "مراقبة المخاطر والقرارات"],
  detail: ["تفاصيل معاملة", "شرح التنبؤ ومؤشرات الاحتيال"],
  audit: ["سجل التدقيق", "أثر كل عملية تنبؤ"]
};

document.querySelectorAll(".nav").forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(event.target));
  const account = users[data.username];

  if (!account || account.password !== data.password) {
    notify("بيانات الدخول غير صحيحة");
    return;
  }

  currentUser = {
    username: data.username,
    role: account.role
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  updateRole();

  if (currentUser.role === "أدمن") showPage("admin");
  else showPage("user");

  notify(`تم تسجيل الدخول كـ ${currentUser.role}`);
});

$("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  updateRole();
  showPage("login");
  notify("تم تسجيل الخروج");
});

function updateRole() {
  $("currentRole").textContent = currentUser ? currentUser.role : "زائر";
  document.body.classList.toggle("logged-out", !currentUser);
  document.body.classList.toggle("is-admin", currentUser?.role === "أدمن");
  document.body.classList.toggle("is-user", currentUser?.role === "مستخدم");
}

function canOpen(page) {
  const adminPages = ["admin", "detail", "audit"];

  if (page === "login") return true;

  if (!currentUser) {
    notify("سجل الدخول أولًا");
    return false;
  }

  if (adminPages.includes(page) && currentUser.role !== "أدمن") {
    notify("هذه الصفحة مخصصة للأدمن فقط");
    return false;
  }

  if (page === "user" && !["مستخدم", "أدمن"].includes(currentUser.role)) {
    notify("لا تملك صلاحية فتح هذه الصفحة");
    return false;
  }

  return true;
}

function showPage(page) {
  if (!canOpen(page)) page = "login";

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav").forEach((n) => n.classList.toggle("active", n.dataset.page === page));

  $(page).classList.add("active");
  $("pageTitle").textContent = titles[page][0];
  $("pageHint").textContent = titles[page][1];

  if (page === "detail") renderDetail();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(txs));
}

function riskColor(score) {
  if (score >= 72) return "#ef4444";
  if (score >= 45) return "#f59e0b";
  return "#10b981";
}

function predict(data) {
  let score = 12;
  const reasons = [];

  const add = (points, text, color) => {
    score += points;
    reasons.push({ points, text, color });
  };

  const amount = Number(data.amount);

  if (amount >= 20000) add(34, "المبلغ مرتفع جدًا مقارنة بالنمط الطبيعي", "#ef4444");
  else if (amount >= 9000) add(22, "المبلغ أعلى من المعتاد", "#f59e0b");

  if (data.newDevice === "yes") add(21, "تسجيل الدخول من جهاز جديد", "#ef4444");
  if (data.newBeneficiary === "yes") add(19, "المستفيد لم يظهر سابقًا في الحساب", "#ef4444");
  if (data.oddTime === "yes") add(12, "وقت تنفيذ غير معتاد", "#f59e0b");
  if (data.failedAttempts === "yes") add(15, "محاولات تحقق فاشلة قبل العملية", "#ef4444");
  if (data.channel === "تحويل فوري") add(8, "قناة عالية السرعة وصعبة الاسترجاع", "#3b82f6");
  if (data.country.trim() !== "السعودية") add(13, "دولة مختلفة عن النطاق المعتاد", "#f59e0b");

  score = Math.min(99, Math.max(3, score));

  if (!reasons.length) {
    reasons.push({ points: 5, text: "لا توجد مؤشرات خطر قوية", color: "#10b981" });
  }

  return {
    score,
    reasons: reasons.sort((a, b) => b.points - a.points),
    decision: score >= 72 ? "احتيال مشتبه" : score >= 45 ? "مراجعة" : "مسموح",
    badge: score >= 72 ? "hold" : score >= 45 ? "review" : "allow"
  };
}

$("txForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) {
    notify("سجل الدخول أولًا");
    showPage("login");
    return;
  }

  const data = Object.fromEntries(new FormData(event.target));
  const result = predict(data);

  const tx = {
    ...data,
    ...result,
    id: "TX-" + Math.floor(100000 + Math.random() * 900000),
    time: new Date().toLocaleString("ar-SA")
  };

  txs.unshift(tx);
  selectedId = tx.id;
  save();
  render();

  $("userScore").textContent = tx.score;
  $("userRing").style.setProperty("--score", tx.score);
  $("userRing").style.setProperty("--color", riskColor(tx.score));
  $("userMessage").innerHTML = `القرار: <b>${tx.decision}</b>. وصلت المعاملة إلى لوحة الأدمن للمراجعة.`;

  notify("تم إرسال المعاملة إلى الأدمن");
});

$("seedData").addEventListener("click", () => {
  if (currentUser?.role !== "أدمن") {
    notify("هذه العملية مخصصة للأدمن فقط");
    return;
  }

  [
    {account:"AC-8821",customer:"سارة أحمد",amount:24800,currency:"SAR",channel:"تحويل فوري",country:"الإمارات",newDevice:"yes",newBeneficiary:"yes",oddTime:"yes",failedAttempts:"yes",note:""},
    {account:"AC-4410",customer:"خالد ناصر",amount:920,currency:"SAR",channel:"بطاقة",country:"السعودية",newDevice:"no",newBeneficiary:"no",oddTime:"no",failedAttempts:"no",note:""},
    {account:"AC-5107",customer:"نورة علي",amount:11400,currency:"SAR",channel:"دفع إلكتروني",country:"السعودية",newDevice:"no",newBeneficiary:"yes",oddTime:"yes",failedAttempts:"no",note:""}
  ].forEach((item) => {
    const result = predict(item);
    txs.unshift({
      ...item,
      ...result,
      id: "TX-" + Math.floor(100000 + Math.random() * 900000),
      time: new Date().toLocaleString("ar-SA")
    });
  });

  selectedId = txs[0].id;
  save();
  render();
  notify("تمت إضافة معاملات تجريبية");
});

$("filter").addEventListener("change", render);

function render() {
  const filter = $("filter").value;
  const list = filter === "all" ? txs : txs.filter((tx) => tx.badge === filter);

  $("txRows").innerHTML = "";
  $("auditRows").innerHTML = "";
  $("emptyState").style.display = txs.length ? "none" : "block";

  list.forEach((tx) => {
    $("txRows").innerHTML += `
      <tr>
        <td>${tx.time}</td>
        <td>${tx.id}</td>
        <td>${tx.customer}<br><small>${tx.account}</small></td>
        <td>${Number(tx.amount).toLocaleString("ar-SA")} ${tx.currency}</td>
        <td>${tx.channel}</td>
        <td style="color:${riskColor(tx.score)}"><b>${tx.score}</b></td>
        <td><span class="badge ${tx.badge}">${tx.decision}</span></td>
        <td><button class="linkbtn" onclick="openDetail('${tx.id}')">التفاصيل</button></td>
      </tr>`;
  });

  txs.forEach((tx) => {
    $("auditRows").innerHTML += `
      <tr>
        <td>${tx.time}</td>
        <td>تنبؤ معاملة</td>
        <td>${tx.id} · ${tx.decision} · درجة ${tx.score}</td>
      </tr>`;
  });

  $("statTotal").textContent = txs.length;
  $("statHold").textContent = txs.filter((tx) => tx.badge === "hold").length;
  $("statReview").textContent = txs.filter((tx) => tx.badge === "review").length;
  $("statAllow").textContent = txs.filter((tx) => tx.badge === "allow").length;
  $("alertCount").textContent = txs.filter((tx) => tx.badge !== "allow").length;
}

function openDetail(id) {
  if (currentUser?.role !== "أدمن") {
    notify("التفاصيل مخصصة للأدمن فقط");
    showPage("login");
    return;
  }

  selectedId = id;
  showPage("detail");
}

function renderDetail() {
  const tx = txs.find((item) => item.id === selectedId);

  if (!tx) {
    $("detailBox").innerHTML = `<div class="panel empty">لا توجد معاملة محددة. اختر معاملة من لوحة الأدمن.</div>`;
    return;
  }

  $("detailBox").innerHTML = `
    <div class="panel">
      <h3>${tx.id}</h3>
      <div class="kv">
        <div><span>العميل</span><b>${tx.customer}</b></div>
        <div><span>الحساب</span><b>${tx.account}</b></div>
        <div><span>المبلغ</span><b>${Number(tx.amount).toLocaleString("ar-SA")} ${tx.currency}</b></div>
        <div><span>القناة</span><b>${tx.channel}</b></div>
        <div><span>القرار</span><b class="${tx.badge} badge">${tx.decision}</b></div>
        <div><span>درجة المخاطر</span><b style="color:${riskColor(tx.score)}">${tx.score}</b></div>
      </div>
    </div>

    <div class="panel">
      <h3>أسباب التنبؤ</h3>
      ${tx.reasons.map((r) => `
        <div class="reason">
          <span>${r.text}</span>
          <span class="bar"><i style="--w:${Math.min(100, r.points * 3)}%;--c:${r.color}"></i></span>
        </div>`).join("")}
    </div>`;
}

function notify(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
}

updateRole();
render();

if (currentUser?.role === "أدمن") showPage("admin");
else if (currentUser?.role === "مستخدم") showPage("user");
else showPage("login");