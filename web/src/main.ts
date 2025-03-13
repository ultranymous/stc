import { createApp } from 'vue'
import './assets/css/main.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
import router from "./router.ts";
import {install_verified_fetch} from "summa-wasm";

registerSW({ immediate: true })
install_verified_fetch(['https://trustless-gateway.link'])

const app = createApp(App);
app.use(router)
app.mount('#app')
