import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './app/Layout.tsx';
import { FlowsPage } from './features/flows/FlowsPage.tsx';
import { FlowEditorPage } from './features/graph/FlowEditorPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/flows" replace />} />
          <Route path="flows" element={<FlowsPage />} />
          <Route path="flows/:id" element={<FlowEditorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
