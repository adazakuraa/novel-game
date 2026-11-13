import { render } from 'preact';
import { loadContent } from './content';
import { App } from './ui/App';
import './ui/style.css';

loadContent();
render(<App />, document.getElementById('app')!);
