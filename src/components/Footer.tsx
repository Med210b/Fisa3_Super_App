import { BRAND } from '../constants';
import { Facebook, Twitter, Instagram, Github as LucideGithub, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <img src={BRAND.logo} alt="FISA3" className="h-10 w-10 object-contain rounded-lg" />
              <span className="font-display font-bold text-2xl tracking-tight">FISA<span className="text-brand">3</span></span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Tunisia's most trusted super app. Delivering food, groceries, electronics, and happiness to your doorstep since 2024.
            </p>
            <div className="flex items-center gap-4">
              {[Facebook, Twitter, Instagram, LucideGithub].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-brand transition-colors">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-lg mb-6">Quick Links</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Restaurants</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Groceries</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Marketplace</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Become a Rider</a></li>
            </ul>
          </div>

          {/* Business */}
          <div>
            <h4 className="font-bold text-lg mb-6">For Business</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Merchant Portal</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Partner with us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Store Management</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Business Dashboard</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Order Management</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold text-lg mb-6">Contact Us</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-brand shrink-0" />
                <span>Lac 2, Tunis, Tunisia</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-brand shrink-0" />
                <span>+216 71 000 000</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-brand shrink-0" />
                <span>contact@fisa3.tn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs font-medium uppercase tracking-widest">
          <p>© 2024 FISA3 Inc. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
            <a href="#" className="hover:text-white">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
