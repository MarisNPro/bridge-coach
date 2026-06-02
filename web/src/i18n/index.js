import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import lv from './lv.json'
import en from './en.json'

i18n.use(initReactI18next).init({
  resources: { lv: { translation: lv }, en: { translation: en } },
  lng: 'lv',          // pilot default; switched to the profile locale after login
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
