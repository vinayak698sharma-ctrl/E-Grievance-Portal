"use strict";
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const authMessage = document.getElementById("authMessage");

function showMessage(message, success) {
  authMessage.textContent = message;
  authMessage.className = success ? "message success" : "message";
}
function showForm(mode) {
  const registering = mode === "register";
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);
  loginTab.setAttribute("aria-selected", String(!registering));
  registerTab.setAttribute("aria-selected", String(registering));
  formTitle.textContent = registering ? "Create Student Account" : "Student Login";
  formSubtitle.textContent = registering ? "Join the portal to raise and track grievances" : "Access your account to continue";
  showMessage("", false);
}
loginTab.addEventListener("click", function () { showForm("login"); });
registerTab.addEventListener("click", function () { showForm("register"); });
document.querySelectorAll("[data-password]").forEach(function (button) {
  button.addEventListener("click", function () {
    const input = document.getElementById(button.dataset.password);
    input.type = input.type === "password" ? "text" : "password";
    button.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
  });
});
async function sendForm(url, payload, button) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = "Please wait...";
  showMessage("", false);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    showMessage(data.message || "Success!", true);
    window.location.href = "/portal";
  } catch (error) {
    showMessage(error.message || "Could not connect to the server. Please try again.", false);
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}
loginForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  sendForm("/api/student/login", { student_id: document.getElementById("loginStudentId").value.trim(), password: document.getElementById("loginPassword").value }, button);
});
registerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const password = document.getElementById("registerPassword").value;
  if (password.length < 8) { showMessage("Please choose a password with at least 8 characters.", false); return; }
  const button = registerForm.querySelector("button[type=submit]");
  sendForm("/api/student/register", { name: document.getElementById("registerName").value.trim(), student_id: document.getElementById("registerStudentId").value.trim(), email: document.getElementById("registerEmail").value.trim(), password: password }, button);
});
fetch("/api/student/session").then(function (response) { return response.json(); }).then(function (data) { if (data.loggedIn) window.location.href = "/portal"; }).catch(function () {});
