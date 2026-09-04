const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");
const moderatorEmail = "angeloyeshuac@gmail.com";
const senderEmail = "AEMATEC <onboarding@resend.dev>";

async function sendEmail(subject, html) {
  const resend = new Resend(resendApiKey.value());
  const { error } = await resend.emails.send({
    from: senderEmail,
    to: [moderatorEmail],
    subject,
    html
  });
  if (error) {
    throw new Error(`Resend rechazó el correo: ${error.message}`);
  }
}

exports.notifyPendingResource = onDocumentCreated(
  { document: "resources/{resourceId}", secrets: [resendApiKey] },
  async event => {
    const resource = event.data?.data();
    if (!resource || resource.status !== "pending") return;
    await sendEmail(
      "Nuevo material pendiente de revisión — Biblioteca AEMATEC",
      `<p>Hay un nuevo material pendiente de revisión:</p>
       <ul><li><strong>${escapeHtml(resource.title)}</strong></li>
       <li>Autor: ${escapeHtml(resource.author)}</li>
       <li>Tipo: ${escapeHtml(resource.type)}</li></ul>
       <p>Ingresa al panel de moderación para aprobarlo o rechazarlo.</p>`
    );
    logger.info("Notificación enviada", { resourceId: event.params.resourceId });
  }
);

exports.sendPendingSummary = onSchedule(
  { schedule: "0 8 * * *", timeZone: "America/Costa_Rica", secrets: [resendApiKey] },
  async () => {
    const snapshot = await admin.firestore()
      .collection("resources")
      .where("status", "==", "pending")
      .get();
    if (snapshot.empty) return;
    await sendEmail(
      `${snapshot.size} material(es) pendiente(s) — Biblioteca AEMATEC`,
      `<p>Hay <strong>${snapshot.size}</strong> material(es) pendiente(s) de revisión.</p>
       <p>Ingresa al panel de moderación para revisarlos.</p>`
    );
    logger.info("Resumen diario enviado", { pending: snapshot.size });
  }
);

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}
