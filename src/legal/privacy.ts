/**
 * Política de Privacidad de Kybo (ES/EN).
 * Documento informativo, no asesoría legal: revísalo con un abogado
 * antes de publicar en las tiendas.
 */

import { APP_NAME, LAST_UPDATED_EN, LAST_UPDATED_ES, SUPPORT_EMAIL } from './terms';

export { APP_NAME, SUPPORT_EMAIL, LAST_UPDATED_EN, LAST_UPDATED_ES };

export interface PrivacySection {
  title: string;
  body: string[];
}

export const PRIVACY_ES: PrivacySection[] = [
  {
    title: '1. Resumen',
    body: [
      'Kybo registra tus gastos e ingresos, organiza presupuestos y responde preguntas financieras con inteligencia artificial.',
      'Tus datos viven primero en tu celular. Solo salen de él lo necesario para darte el servicio: transcribir tu voz, responder con IA y —si eres Pro— respaldar en la nube.',
      'No vendemos tus datos personales ni los compartimos con anunciantes.',
    ],
  },
  {
    title: '2. Datos que recopilamos',
    body: [
      'Cuenta: si usas la app como invitado, solo se crea un identificador anónimo. Si vinculas Google, guardamos tu correo, nombre visible y el identificador de tu cuenta para reconocer tu sesión.',
      'Contenido financiero: gastos, ingresos, categorías, presupuestos y notas que registres. Viven en la base de datos local de tu dispositivo (SQLite).',
      'Voz: cuando dictas un gasto, se graba un audio temporal para transcribirlo.',
      'Compras: si te suscribes a Pro, Apple o Google procesan el pago. Nosotros solo recibimos la confirmación de tu suscripción a través de RevenueCat (nunca vemos tu tarjeta ni tus datos bancarios).',
      'Diagnóstico técnico: errores anónimos de la app para corregir fallos. No incluyen tus montos ni descripciones.',
    ],
  },
  {
    title: '3. Inteligencia artificial: qué se envía a un LLM',
    body: [
      'Para transcribir tu voz y generar respuestas, la app envía a nuestros servidores —y estos a un modelo de lenguaje (LLM)— únicamente los datos necesarios para cada tarea: el audio a transcribir, el texto de tu pregunta o un resumen de tus gastos del período consultado.',
      'No se envía tu base de datos completa: solo el fragmento mínimo que requiere la respuesta.',
      'Los audios se procesan para transcribirlos y luego se descartan; no se conservan grabaciones de tu voz.',
      'Las respuestas de la IA son informativas y educativas, no asesoría financiera. Los proveedores de IA pueden procesar estos datos según sus propias políticas para prestar el servicio.',
    ],
  },
  {
    title: '4. Respaldo en la nube (solo Pro)',
    body: [
      'Si eres Pro y activas el respaldo, tus gastos se copian a nuestra base de datos en la nube asociados a tu cuenta, para recuperarlos si cambias de celular y mantenerlos sincronizados.',
      'Sin Pro no hay respaldo: tus datos existen únicamente en tu dispositivo.',
      'Si eliminas tu cuenta, tu respaldo en la nube queda huérfano (sin vínculo con tu identidad) y tus datos locales del celular se conservan hasta que desinstales la app.',
    ],
  },
  {
    title: '5. Terceros que procesan datos',
    body: [
      'Firebase (Google): autenticación anónima o con Google y tokens de sesión.',
      'Google Sign-In: vinculación opcional de tu cuenta de Google.',
      'RevenueCat: verificación del estado de tu suscripción Pro.',
      'Apple App Store / Google Play: procesamiento de pagos de la suscripción.',
      'Proveedor de IA: transcripción de voz y respuestas sobre tus finanzas.',
      'Cada tercero aplica su propia política de privacidad además de esta.',
    ],
  },
  {
    title: '6. Seguridad y conservación',
    body: [
      'Las comunicaciones con nuestros servidores viajan cifradas (HTTPS) y las llamadas exigen tu token de sesión.',
      'Conservamos tus datos en la nube solo mientras tu cuenta exista y sea necesario para el respaldo. Los datos locales se borran al desinstalar la aplicación.',
      'Ningún sistema es 100 % seguro: protege tu dispositivo con bloqueo de pantalla y no compartas tu sesión.',
    ],
  },
  {
    title: '7. Tus derechos',
    body: [
      'Puedes usar la app como invitado, vincular o desvincular Google, cerrar sesión y eliminar tu cuenta desde la pantalla Cuenta.',
      'Puedes pedir acceso, corrección o eliminación de tus datos en la nube escribiendo a nuestro correo de soporte.',
      'Si la ley de tu país te otorga más derechos sobre tus datos personales, los respetamos.',
    ],
  },
  {
    title: '8. Menores de edad',
    body: [
      'La aplicación está dirigida a adultos. Si tienes menos de 18 años, úsala solo bajo supervisión de un adulto responsable.',
    ],
  },
  {
    title: '9. Cambios y contacto',
    body: [
      'Podemos actualizar esta política cuando cambien la app o la ley. La fecha de actualización aparece al inicio y los cambios importantes se avisarán en la aplicación.',
      'Para preguntas sobre privacidad o tus datos, escríbenos al correo de soporte.',
    ],
  },
];

export const PRIVACY_EN: PrivacySection[] = [
  {
    title: '1. Summary',
    body: [
      'Kybo logs your expenses and income, organizes budgets, and answers financial questions with artificial intelligence.',
      'Your data lives first on your phone. Only what is needed to provide the service leaves it: transcribing your voice, answering with AI and —if you are Pro— backing up to the cloud.',
      'We do not sell your personal data nor share it with advertisers.',
    ],
  },
  {
    title: '2. Data we collect',
    body: [
      'Account: if you use the app as a guest, only an anonymous identifier is created. If you link Google, we store your email, display name, and account identifier to recognize your session.',
      'Financial content: expenses, income, categories, budgets, and notes you log. They live in your device local database (SQLite).',
      'Voice: when you dictate an expense, a temporary audio is recorded to transcribe it.',
      'Purchases: if you subscribe to Pro, Apple or Google process the payment. We only receive your subscription confirmation through RevenueCat (we never see your card or banking details).',
      'Technical diagnostics: anonymous app errors to fix crashes. They do not include your amounts or descriptions.',
    ],
  },
  {
    title: '3. Artificial intelligence: what is sent to an LLM',
    body: [
      'To transcribe your voice and generate answers, the app sends to our servers —and these to a language model (LLM)— only the data needed for each task: the audio to transcribe, your question text, or a summary of your expenses for the queried period.',
      'Your full database is never sent: only the minimum fragment each answer requires.',
      'Audios are processed for transcription and then discarded; no voice recordings are kept.',
      'AI answers are informational and educational, not financial advice. AI providers may process this data under their own policies to render the service.',
    ],
  },
  {
    title: '4. Cloud backup (Pro only)',
    body: [
      'If you are Pro and enable backup, your expenses are copied to our cloud database tied to your account, so you can recover them if you change phones and keep them synced.',
      'Without Pro there is no backup: your data exists only on your device.',
      'If you delete your account, your cloud backup becomes orphaned (unlinked from your identity) and your local phone data remains until you uninstall the app.',
    ],
  },
  {
    title: '5. Third parties that process data',
    body: [
      'Firebase (Google): anonymous or Google authentication and session tokens.',
      'Google Sign-In: optional linking of your Google account.',
      'RevenueCat: verification of your Pro subscription status.',
      'Apple App Store / Google Play: subscription payment processing.',
      'AI provider: voice transcription and answers about your finances.',
      'Each third party applies its own privacy policy in addition to this one.',
    ],
  },
  {
    title: '6. Security and retention',
    body: [
      'Communications with our servers travel encrypted (HTTPS) and calls require your session token.',
      'We keep your cloud data only while your account exists and backup requires it. Local data is deleted when you uninstall the app.',
      'No system is 100% secure: protect your device with a screen lock and do not share your session.',
    ],
  },
  {
    title: '7. Your rights',
    body: [
      'You can use the app as a guest, link or unlink Google, sign out, and delete your account from the Account screen.',
      'You can request access, correction, or deletion of your cloud data by writing to our support email.',
      'If your country law grants you further rights over your personal data, we honor them.',
    ],
  },
  {
    title: '8. Children',
    body: [
      'The app is intended for adults. If you are under 18, use it only under responsible adult supervision.',
    ],
  },
  {
    title: '9. Changes and contact',
    body: [
      'We may update this policy when the app or the law changes. The update date appears at the top and important changes will be announced in the app.',
      'For privacy or data questions, write to our support email.',
    ],
  },
];
