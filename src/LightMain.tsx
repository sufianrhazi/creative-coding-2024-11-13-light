import Gooey, { mount } from '@srhazi/gooey';

import { LightApp } from './LightApp';

import './LightMain.css';

const app = document.getElementById('app');
if (!app) {
    alert('RUH ROH, no #app element found');
} else {
    mount(app, <LightApp />);
}
