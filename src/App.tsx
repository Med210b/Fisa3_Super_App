import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect, ReactNode } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import StoreDetail from './pages/StoreDetail';
import AdminDashboard from './pages/AdminDashboard';
import Tracking from './pages/Tracking';
import Auth from './pages/Auth';
import Stores from './pages/Stores';
import Orders from './pages/Orders';
import RiderDashboard from './pages/RiderDashboard';
import MerchantDashboard from './pages/MerchantDashboard';
import Splash from './components/Splash';
import ChatSupport from './components/ChatSupport';
import { ThemeProvider } from './context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Toaster } from 'sonner';
import NotificationListener from './components/NotificationListener';

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/admin') || 
                      location.pathname.startsWith('/merchant') || 
                      location.pathname.startsWith('/rider');

  return (
    <div className="min-h-screen flex flex-col">
      {!isDashboard && <Navbar />}
      <main className={cn("flex-grow", !isDashboard && "pt-16")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {!isDashboard && <Footer />}
      {!isDashboard && <ChatSupport />}
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <Toaster position="top-right" richColors closeButton />
      <NotificationListener />
      <AnimatePresence>
        {loading && <Splash />}
      </AnimatePresence>
      
      {!loading && (
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/store/:id" element={<StoreDetail />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/tracking" element={<Tracking />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/stores" element={<Stores />} />
                <Route path="/food" element={<Stores />} />
                <Route path="/grocery" element={<Stores />} />
                <Route path="/marketplace" element={<Stores />} />
                <Route path="/merchant" element={<MerchantDashboard />} />
                <Route path="/rider" element={<RiderDashboard />} />
              </Routes>
            </Layout>
          </Router>
        )}
      </ThemeProvider>
    );
  }
