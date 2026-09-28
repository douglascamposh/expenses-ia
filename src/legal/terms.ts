/**
 * Términos y Condiciones de Kybo (ES/EN).
 * Documento informativo, no asesoría legal: revísalo con un abogado
 * antes de publicar en las tiendas.
 */

export const APP_NAME = 'Kybo';
export const SUPPORT_EMAIL = 'soporte@kybo.app';
export const LAST_UPDATED_ES = 'septiembre de 2026';
export const LAST_UPDATED_EN = 'September 2026';

export interface TermsSection {
  title: string;
  body: string[];
}

export const TERMS_ES: TermsSection[] = [
  {
    title: '1. Bienvenido a Kybo',
    body: [
      'Kybo es una aplicación móvil para registrar gastos e ingresos, organizar presupuestos y recibir análisis financieros con inteligencia artificial.',
      'Al usar la aplicación aceptas estos Términos y Condiciones. Si no estás de acuerdo, no uses la aplicación.',
    ],
  },
  {
    title: '2. Tu cuenta',
    body: [
      'Puedes usar la aplicación como invitado o vincular tu cuenta de Google. Eres responsable de mantener la seguridad de tu cuenta y de tu dispositivo.',
      'Debes tener al menos 18 años, o usar la aplicación bajo supervisión de un adulto responsable.',
      'Si cambias de celular, vincula tu cuenta de Google para conservar tu acceso. Sin cuenta vinculada no podemos recuperar tu acceso.',
    ],
  },
  {
    title: '3. Uso aceptable',
    body: [
      'Te comprometes a no abusar del servicio: no intentes vulnerar la aplicación, saturar los servicios de inteligencia artificial ni usarla para actividades ilegales.',
      'El contenido que registres (gastos, descripciones, notas de voz) debe ser tuyo o debes tener derecho a usarlo.',
    ],
  },
  {
    title: '4. Plan gratuito y suscripción Pro',
    body: [
      'La aplicación es freemium: incluye un plan gratuito con funciones básicas y límites de uso (por ejemplo, preguntas a la IA y registros por voz al día).',
      'La suscripción Pro amplía esos límites e incluye funciones adicionales como el respaldo en la nube. Los precios se muestran antes de pagar.',
      'Los pagos se procesan exclusivamente a través de Apple App Store o Google Play. La renovación es automática salvo que la canceles en tu tienda antes del vencimiento.',
      'Las cancelaciones y reembolsos se gestionan según las políticas de Apple o Google, no directamente por nosotros.',
    ],
  },
  {
    title: '5. Inteligencia artificial: cómo funciona y sus límites',
    body: [
      'La aplicación usa inteligencia artificial para transcribir tu voz, detectar gastos y responder preguntas sobre tus finanzas. Para hacerlo, envía a nuestros servidores únicamente los datos necesarios (por ejemplo, el audio a transcribir o un resumen de tus gastos del período).',
      'Tus datos de usuario (gastos, ingresos, presupuestos y categorías) se guardan en la base de datos local de tu dispositivo. Solo salen de tu celular los fragmentos necesarios para generar cada respuesta de IA.',
      'Los análisis, sugerencias y respuestas de la IA son solo informativos y educativos. No constituyen asesoría financiera, contable, fiscal ni legal.',
      'Verifica la información importante antes de tomar decisiones de dinero. No nos hacemos responsables por decisiones tomadas con base en respuestas de la IA.',
    ],
  },
  {
    title: '6. Voz y transcripción',
    body: [
      'Al dictar por voz, el audio se envía a nuestros servidores únicamente para transcribirlo y detectar tus gastos. No usamos tus grabaciones con fines publicitarios.',
      'Necesitas conexión a internet y permiso de micrófono para usar el dictado.',
    ],
  },
  {
    title: '7. Respaldo y tus datos',
    body: [
      'Tus datos de usuario se guardan en la base de datos local de tu dispositivo: esa es la fuente principal y viven en tu celular, no en nuestros servidores.',
      'El respaldo en la nube (para usuarios Pro con cuenta vinculada) te permite recuperarlos al cambiar de celular.',
      'Eres responsable de mantener tu cuenta vinculada si quieres conservar el respaldo. Si eliminas tu cuenta, el respaldo asociado se pierde.',
    ],
  },
  {
    title: '8. Privacidad',
    body: [
      'El tratamiento de tus datos personales se describe en nuestra Política de Privacidad. Al usar la aplicación aceptas dicho tratamiento.',
      'Nunca te pediremos tu contraseña bancaria ni los datos de tus tarjetas dentro de la aplicación.',
    ],
  },
  {
    title: '9. Propiedad intelectual',
    body: [
      'La aplicación, su diseño, textos y marcas pertenecen a sus titulares y están protegidos por ley. No puedes copiarlos ni redistribuirlos sin autorización.',
      'Tus datos (tus gastos e ingresos) siguen siendo tuyos.',
    ],
  },
  {
    title: '10. Disponibilidad del servicio',
    body: [
      'Hacemos lo posible por mantener la aplicación disponible, pero no garantizamos un servicio ininterrumpido ni libre de errores. Podemos actualizar, pausar o modificar funciones con aviso razonable.',
    ],
  },
  {
    title: '11. Limitación de responsabilidad',
    body: [
      'En la medida permitida por la ley, no respondemos por daños indirectos, pérdida de datos o decisiones financieras derivadas del uso de la aplicación.',
    ],
  },
  {
    title: '12. Terminación',
    body: [
      'Puedes dejar de usar la aplicación y eliminar tu cuenta cuando quieras desde Ajustes > Cuenta.',
      'Podemos suspender cuentas que incumplan estos términos o hagan uso abusivo del servicio.',
    ],
  },
  {
    title: '13. Cambios a estos términos',
    body: [
      'Podemos actualizar estos términos. Los cambios importantes se comunicarán dentro de la aplicación y seguir usándola implica aceptarlos.',
    ],
  },
  {
    title: '14. Contacto',
    body: [
      `Para preguntas sobre estos términos escríbenos a ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: '15. Ley aplicable',
    body: [
      'Estos términos se rigen por las leyes aplicables en tu lugar de residencia. Los pagos están además sujetos a los términos de Apple App Store o Google Play, según corresponda.',
    ],
  },
];

export const TERMS_EN: TermsSection[] = [
  {
    title: '1. Welcome to Kybo',
    body: [
      'Kybo is a mobile app to track expenses and income, organize budgets, and receive AI-powered financial insights.',
      'By using the app you accept these Terms and Conditions. If you disagree, do not use the app.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'You can use the app as a guest or link your Google account. You are responsible for keeping your account and device secure.',
      'You must be at least 18 years old, or use the app under the supervision of a responsible adult.',
      'If you switch phones, link your Google account to keep your access. Without a linked account we cannot restore your access.',
    ],
  },
  {
    title: '3. Acceptable use',
    body: [
      'You agree not to abuse the service: do not attempt to breach the app, overload the AI services, or use it for illegal activities.',
      'Content you register (expenses, descriptions, voice notes) must be yours or you must have the right to use it.',
    ],
  },
  {
    title: '4. Free plan and Pro subscription',
    body: [
      'The app is freemium: it includes a free plan with basic features and usage limits (for example, AI questions and voice entries per day).',
      'The Pro subscription raises those limits and adds features such as cloud backup. Prices are shown before you pay.',
      'Payments are processed exclusively through the Apple App Store or Google Play. Renewal is automatic unless you cancel in your store before expiry.',
      'Cancellations and refunds follow Apple or Google policies, not ours directly.',
    ],
  },
  {
    title: '5. Artificial intelligence: how it works and its limits',
    body: [
      'The app uses artificial intelligence to transcribe your voice, detect expenses, and answer questions about your finances. To do so, it sends our servers only the data needed (for example, the audio to transcribe or a summary of your expenses for the period).',
      'Your user data (expenses, income, budgets, and categories) is stored in the local database on your device. Only the fragments needed to generate each AI answer leave your phone.',
      'AI analyses, suggestions, and answers are for informational and educational purposes only. They are not financial, accounting, tax, or legal advice.',
      'Verify important information before making money decisions. We are not liable for decisions made based on AI answers.',
    ],
  },
  {
    title: '6. Voice and transcription',
    body: [
      'When you dictate by voice, audio is sent to our servers only to transcribe it and detect your expenses. We do not use your recordings for advertising.',
      'You need an internet connection and microphone permission to use dictation.',
    ],
  },
  {
    title: '7. Backup and your data',
    body: [
      'Your user data is stored in the local database on your device: that is the primary source, and it lives on your phone, not on our servers.',
      'Cloud backup (for Pro users with a linked account) lets you restore them when you switch phones.',
      'You are responsible for keeping your account linked if you want to keep the backup. If you delete your account, the associated backup is lost.',
    ],
  },
  {
    title: '8. Privacy',
    body: [
      'How we handle your personal data is described in our Privacy Policy. By using the app you accept that handling.',
      'We will never ask for your bank password or card details inside the app.',
    ],
  },
  {
    title: '9. Intellectual property',
    body: [
      'The app, its design, texts, and trademarks belong to their owners and are protected by law. You may not copy or redistribute them without permission.',
      'Your data (your expenses and income) remains yours.',
    ],
  },
  {
    title: '10. Service availability',
    body: [
      'We do our best to keep the app available, but we do not guarantee uninterrupted or error-free service. We may update, pause, or modify features with reasonable notice.',
    ],
  },
  {
    title: '11. Limitation of liability',
    body: [
      'To the extent permitted by law, we are not liable for indirect damages, data loss, or financial decisions arising from the use of the app.',
    ],
  },
  {
    title: '12. Termination',
    body: [
      'You can stop using the app and delete your account at any time from Settings > Account.',
      'We may suspend accounts that breach these terms or abuse the service.',
    ],
  },
  {
    title: '13. Changes to these terms',
    body: [
      'We may update these terms. Material changes will be communicated inside the app, and continued use implies acceptance.',
    ],
  },
  {
    title: '14. Contact',
    body: [
      `For questions about these terms write to ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: '15. Governing law',
    body: [
      'These terms are governed by the laws applicable in your place of residence. Payments are also subject to Apple App Store or Google Play terms, as applicable.',
    ],
  },
];
