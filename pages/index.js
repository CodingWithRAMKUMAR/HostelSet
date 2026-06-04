// pages/index.js - Fixed version
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  Wifi, 
  Coffee, 
  Shield, 
  Star, 
  Users, 
  Building2,
  ChevronRight,
  HomeIcon,
  Sparkles,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Twitter,
  Menu,
  X,
  Filter,
  Bed,
  DollarSign,
  Heart,
  Share2,
  Clock,
  Trophy,
  Award,
  Zap,
  Eye
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalCities: 0,
    totalRooms: 0,
    avgRating: 4.8
  });

  useEffect(() => {
    checkUser();
    fetchProperties();
    fetchStats();
  }, []);

  useEffect(() => {
    filterProperties();
  }, [searchTerm, searchCity, selectedCategory, properties]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  }

  async function fetchStats() {
    try {
      const { count: propertyCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });
      
      const { data: cities } = await supabase
        .from('properties')
        .select('city');
      
      const uniqueCities = [...new Set(cities?.map(c => c.city).filter(Boolean))];
      
      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalProperties: propertyCount || 0,
        totalCities: uniqueCities.length || 0,
        totalRooms: roomCount || 0,
        avgRating: 4.8
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  async function fetchProperties() {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          rooms (
            id,
            room_number,
            sharing_type,
            rent,
            is_available
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const processedProperties = data?.map(prop => ({
        ...prop,
        min_rent: prop.rooms && prop.rooms.length > 0 
          ? Math.min(...prop.rooms.map(r => r.rent))
          : 0,
        available_rooms: prop.rooms?.filter(r => r.is_available).length || 0,
        total_rooms: prop.rooms?.length || 0
      })) || [];
      
      setProperties(processedProperties);
      setFilteredProperties(processedProperties);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterProperties() {
    let filtered = [...properties];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(prop => 
        prop.property_type?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(prop =>
        prop.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prop.area && prop.area.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (searchCity) {
      filtered = filtered.filter(prop =>
        prop.city?.toLowerCase().includes(searchCity.toLowerCase())
      );
    }

    setFilteredProperties(filtered);
  }

  const categories = [
    { id: 'all', name: 'All Properties', icon: Building2, description: 'View all properties' },
    { id: 'boys', name: 'Boys Hostel', icon: Users, description: 'Safe & secure for boys' },
    { id: 'girls', name: 'Girls Hostel', icon: HomeIcon, description: 'Women safety prioritized' },
    { id: 'co-ed', name: 'Co-ed', icon: Users, description: 'Mixed accommodation' },
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0 }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => router.push('/')}
            >
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <HomeIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">HostelSet</span>
            </motion.div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-slate-600 hover:text-slate-900 transition font-medium">Home</Link>
              <Link href="/properties" className="text-slate-600 hover:text-slate-900 transition font-medium">Properties</Link>
              <Link href="/about" className="text-slate-600 hover:text-slate-900 transition font-medium">About</Link>
              <Link href="/contact" className="text-slate-600 hover:text-slate-900 transition font-medium">Contact</Link>
              
              {user ? (
                <button 
                  onClick={() => router.push(user.user_metadata?.role === 'owner' ? '/owner/dashboard' : '/tenant/dashboard')}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all hover:scale-105 font-medium"
                >
                  Dashboard
                </button>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link 
                    href="/login?role=tenant" 
                    className="px-4 py-2 text-slate-700 hover:text-slate-900 transition font-medium"
                  >
                    Tenant Login
                  </Link>
                  <Link 
                    href="/login?role=owner" 
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all hover:scale-105 font-medium"
                  >
                    Owner Login
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-slate-200"
            >
              <div className="px-4 py-4 space-y-3">
                <Link href="/" className="block text-slate-600 hover:text-slate-900">Home</Link>
                <Link href="/properties" className="block text-slate-600 hover:text-slate-900">Properties</Link>
                <Link href="/about" className="block text-slate-600 hover:text-slate-900">About</Link>
                <Link href="/contact" className="block text-slate-600 hover:text-slate-900">Contact</Link>
                {user ? (
                  <button 
                    onClick={() => router.push(user.user_metadata?.role === 'owner' ? '/owner/dashboard' : '/tenant/dashboard')}
                    className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg text-center"
                  >
                    Dashboard
                  </button>
                ) : (
                  <>
                    <Link href="/login?role=tenant" className="block w-full px-4 py-2 text-slate-700 border border-slate-200 rounded-lg text-center">
                      Tenant Login
                    </Link>
                    <Link href="/login?role=owner" className="block w-full px-4 py-2 bg-slate-900 text-white rounded-lg text-center">
                      Owner Login
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-2 bg-white shadow-sm px-4 py-2 rounded-full border border-slate-200 mb-6"
            >
              <Sparkles className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-slate-600">Trusted by {stats.totalProperties}+ Residents</span>
            </motion.div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-slate-900">
              Find Your Perfect
              <br />
              <span className="text-slate-700">Hostel & PG</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              Discover verified hostels and PGs across India. Safe, comfortable, and affordable living spaces for students and professionals.
            </p>

            {/* Search Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white rounded-2xl shadow-lg p-2 flex flex-col md:flex-row items-stretch md:items-center gap-2 border border-slate-200">
                <div className="flex-1 flex items-center gap-2 px-4 border-b md:border-b-0 md:border-r border-slate-200">
                  <Search className="w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Hostel name or area..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-3 outline-none text-slate-700 placeholder-slate-400"
                  />
                </div>
                <div className="flex-1 flex items-center gap-2 px-4">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="City..."
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    className="w-full py-3 outline-none text-slate-700 placeholder-slate-400"
                  />
                </div>
                <button 
                  onClick={() => filterProperties()}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all hover:scale-105 font-medium"
                >
                  Search
                </button>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16"
            >
              <motion.div variants={fadeInUp} className="text-center">
                <div className="text-3xl font-bold text-slate-900">{stats.totalProperties}+</div>
                <div className="text-slate-600 mt-1">Properties</div>
              </motion.div>
              <motion.div variants={fadeInUp} className="text-center">
                <div className="text-3xl font-bold text-slate-900">{stats.totalCities}+</div>
                <div className="text-slate-600 mt-1">Cities</div>
              </motion.div>
              <motion.div variants={fadeInUp} className="text-center">
                <div className="text-3xl font-bold text-slate-900">{stats.totalRooms}+</div>
                <div className="text-slate-600 mt-1">Rooms Available</div>
              </motion.div>
              <motion.div variants={fadeInUp} className="text-center">
                <div className="text-3xl font-bold text-slate-900">{stats.avgRating}</div>
                <div className="text-slate-600 mt-1">Average Rating</div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Browse by Property Type</h2>
            <p className="text-slate-600">Find the perfect accommodation that suits your needs</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((category) => (
              <motion.button
                key={category.id}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory(category.id)}
                className={`relative group p-6 rounded-2xl transition-all text-left ${
                  selectedCategory === category.id
                    ? 'bg-slate-900 text-white shadow-xl'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:shadow-md'
                }`}
              >
                <category.icon className={`w-8 h-8 mb-3 ${selectedCategory === category.id ? 'text-white' : 'text-slate-600'}`} />
                <div className="font-semibold text-lg">{category.name}</div>
                <div className={`text-sm mt-1 ${selectedCategory === category.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {category.description}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Featured Properties</h2>
              <p className="text-slate-600">Handpicked hostels just for you</p>
            </div>
          </motion.div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No properties found</h3>
              <p className="text-slate-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredProperties.slice(0, 6).map((property, index) => (
                <motion.div
                  key={property.id}
                  variants={fadeInUp}
                  whileHover={{ y: -8 }}
                  className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => router.push(`/property/${property.id}`)}
                >
                  <div className="relative h-56 overflow-hidden bg-slate-100">
                    {property.photos && property.photos[0] ? (
                      <img 
                        src={property.photos[0]} 
                        alt={property.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-16 h-16 text-slate-300" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-sm font-semibold text-slate-900">
                      ⭐ {stats.avgRating}
                    </div>
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                      Verified
                    </div>
                    {property.available_rooms > 0 && (
                      <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                        {property.available_rooms} rooms available
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-1 line-clamp-1">{property.name}</h3>
                    <div className="flex items-center gap-1 text-slate-600 mb-3">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm line-clamp-1">{property.city}, {property.area}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {property.amenities?.slice(0, 3).map((amenity, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                          {amenity}
                        </span>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-2xl font-bold text-slate-900">₹{property.min_rent}</span>
                        <span className="text-slate-600">/month</span>
                      </div>
                      <button className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all hover:scale-105 text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Why Choose HostelSet?</h2>
            <p className="text-slate-600">We make finding your next home easy and reliable</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Verified Properties',
                description: 'All properties are verified by our team for authenticity and safety'
              },
              {
                icon: Trophy,
                title: 'Best Price Guarantee',
                description: 'Get the best deals on hostels and PGs across all major cities'
              },
              {
                icon: Users,
                title: '24/7 Support',
                description: 'Our customer support team is always ready to help you'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-6 rounded-2xl bg-slate-50 hover:shadow-lg transition-all"
              >
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-900" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Ready to Find Your New Home?
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              Join thousands of students and professionals who found their perfect hostel with HostelSet
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login?role=tenant">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 bg-white text-slate-900 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  Find a Hostel
                  <ArrowRight className="inline ml-2 w-5 h-5" />
                </motion.button>
              </Link>
              <Link href="/login?role=owner">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-all"
                >
                  List Your Property
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <HomeIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">HostelSet</span>
              </div>
              <p className="text-slate-600">Find your perfect home away from home. Trusted by thousands of residents across India.</p>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Quick Links</h4>
              <ul className="space-y-2 text-slate-600">
                <li><Link href="/" className="hover:text-slate-900 transition">Home</Link></li>
                <li><Link href="/properties" className="hover:text-slate-900 transition">Properties</Link></li>
                <li><Link href="/about" className="hover:text-slate-900 transition">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-slate-900 transition">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">For Owners</h4>
              <ul className="space-y-2 text-slate-600">
                <li><Link href="/login?role=owner" className="hover:text-slate-900 transition">List Your Property</Link></li>
                <li><Link href="/owner/dashboard" className="hover:text-slate-900 transition">Owner Dashboard</Link></li>
                <li><Link href="/owner/register-property" className="hover:text-slate-900 transition">Add Property</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Contact Us</h4>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>+91 1234567890</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>support@hostelset.com</span>
                </li>
              </ul>
              <div className="flex gap-4 mt-4">
                <Facebook className="w-5 h-5 text-slate-600 hover:text-slate-900 cursor-pointer transition" />
                <Instagram className="w-5 h-5 text-slate-600 hover:text-slate-900 cursor-pointer transition" />
                <Twitter className="w-5 h-5 text-slate-600 hover:text-slate-900 cursor-pointer transition" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 text-center text-slate-600">
            <p>&copy; 2024 HostelSet. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
