import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      welcome: "Everything you need, delivered FISA3.",
      searchPlaceholder: "Search for restaurants, groceries...",
      signin: "Sign In",
      downloadApp: "Download App",
      festestDelivery: "Fastest Delivery in Tunisia"
    }
  },
  fr: {
    translation: {
      welcome: "Tout ce dont vous avez besoin, livré FISA3.",
      searchPlaceholder: "Rechercher des restaurants, courses...",
      signin: "Se Connecter",
      downloadApp: "Télécharger l'App",
      festestDelivery: "Livraison la plus rapide en Tunisie"
    }
  },
  ar: {
    translation: {
      welcome: "كل ما تحتاجه ، يوصلك فيسع.",
      searchPlaceholder: "ابحث عن مطاعم ، بقالة...",
      signin: "تسجيل الدخول",
      downloadApp: "تحميل التطبيق",
      festestDelivery: "أسرع توصيل في تونس"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
