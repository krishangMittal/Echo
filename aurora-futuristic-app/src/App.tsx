import { DailyProvider } from '@daily-co/daily-react';
import FuturisticAuroraInterface from './components/FuturisticAuroraInterface';

function App() {
  return (
    <DailyProvider>
      <FuturisticAuroraInterface />
    </DailyProvider>
  );
}

export default App;