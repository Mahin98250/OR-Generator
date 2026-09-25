import { Navigate, Route, Routes } from 'react-router-dom';
import { Home } from '../pages/Home/Home';
import { History } from '../pages/History/History';
import { Scanner } from '../pages/Scanner/Scanner';
import { Settings } from '../pages/Settings/Settings';
import { Generator } from '../pages/Generator/Generator';
import { Statistics } from '../pages/Statistics/Statistics';
import { Tools } from '../pages/Tools/Tools';
import { Transfer } from '../pages/Transfer/Transfer';
import { OptiFrameLab } from '../pages/OptiFrameLab/OptiFrameLab';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/generator" element={<Generator />} />
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/history" element={<History />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/transfer" element={<Transfer />} />
      <Route path="/optiframe" element={<OptiFrameLab />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
