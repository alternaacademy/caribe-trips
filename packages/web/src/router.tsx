import { AgentLayout } from '@/agent/AgentLayout';
import { BookingsPage } from '@/agent/pages/Bookings/BookingsPage';
import { PackageEditorPage } from '@/agent/pages/PackageEditor/PackageEditorPage';
import { PackagesPage } from '@/agent/pages/Packages/PackagesPage';
import { AppLayout } from '@/layouts/AppLayout';
import { MisReservasPage } from '@/mobile/pages/MisReservas/MisReservasPage';
import { BookPage } from '@/pages/Book/BookPage';
import { ConfirmationPage } from '@/pages/Confirmation/ConfirmationPage';
import { Home } from '@/pages/Home/Home';
import { PackagePage } from '@/pages/Package/PackagePage';
import { UiKit } from '@/pages/UiKit';
import { Navigate, createBrowserRouter } from 'react-router-dom';

/** Route tree: English routes, Spanish screen names. Customer routes live under
 *  the phone-frame `AppLayout`; agent routes under the backoffice `AgentLayout`. */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/buscar', element: <Home /> },
      { path: '/mis-reservas', element: <MisReservasPage /> },
      { path: '/packages/:id', element: <PackagePage /> },
      { path: '/book/:id', element: <BookPage /> },
      { path: '/booking/:code', element: <ConfirmationPage /> },
      { path: '/ui-kit', element: <UiKit /> },
    ],
  },
  {
    path: '/agent',
    element: <AgentLayout />,
    children: [
      { index: true, element: <Navigate to="/agent/bookings" replace /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'packages', element: <PackagesPage /> },
      { path: 'packages/:id', element: <PackageEditorPage /> },
    ],
  },
]);
