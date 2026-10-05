import DefaultTheme from 'vitepress/theme';
import PvSample from './PvSample.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PvSample', PvSample);
  },
};
