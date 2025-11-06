import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import serverless from 'serverless-http';

const app = express();

// CORS configuration (unchanged)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(express.json());

// Mongoose connection caching (similar to your original)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
    throw new Error("MONGO_URI environment variable is not set");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      dbName: 'KarshanGhela',  // Specify DB name
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Define Mongoose schemas/models (add based on your data)
const productSchema = new mongoose.Schema({
  name: String,
  category_id: mongoose.Schema.Types.ObjectId,
  is_featured: Boolean,
  display_order: Number,
  // Add other fields as needed
});

const categorySchema = new mongoose.Schema({
  name: String,
  display_order: Number,
  // Add other fields
});

const testimonialSchema = new mongoose.Schema({
  content: String,
  is_active: Boolean,
  display_order: Number,
  // Add other fields
});

const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now },
});

const Product = mongoose.model('Product', productSchema);
const Category = mongoose.model('Category', categorySchema);
const Testimonial = mongoose.model('Testimonial', testimonialSchema);
const Contact = mongoose.model('ContactSubmission', contactSchema);  // Assuming collection name

// Root route (unchanged)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Karshan Ghela API',
    status: 'running',
    endpoints: [
      '/api/health',
      '/api/products',
      '/api/products/featured',
      '/api/categories',
      '/api/testimonials',
      '/api/contact (POST)'
    ]
  });
});

// Health check (unchanged)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running on Vercel',
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGO_URI,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// Products routes (updated with Mongoose)
app.get('/api/products', async (req, res) => {
  try {
    await connectDB();
    const products = await Product.find({})
      .sort({ display_order: 1 })
      .limit(50)  // Keep the limit to prevent timeouts
      .populate('category_id');  // If you want to auto-populate categories

    res.json(products);
  } catch (err) {
    console.error('Products error:', err);
    res.status(500).json({ error: 'Failed to fetch products', message: err.message });
    console.error('Products error:', err);
    res.status(500).json({ error: 'Failed to fetch products', message: err.message });
  }
});

app.get('/api/products/featured', async (req, res) => {
  try {
    await connectDB();
    const products = await Product.find({ is_featured: true })
      .sort({ display_order: 1 })
      .limit(20)
      .populate('category_id');

    res.json(products);
  } catch (err) {
    console.error('Featured products error:', err);
    res.status(500).json({ error: 'Failed to fetch featured products', message: err.message });
    console.error('Featured products error:', err);
    res.status(500).json({ error: 'Failed to fetch featured products', message: err.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    await connectDB();
    const categories = await Category.find({})
      .sort({ display_order: 1 })
      .limit(50);
    res.json(categories);
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories', message: err.message });
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories', message: err.message });
  }
});

app.get('/api/testimonials', async (req, res) => {
  try {
    await connectDB();
    const testimonials = await Testimonial.find({ is_active: true })
      .sort({ display_order: 1 })
      .limit(50);
    res.json(testimonials);
  } catch (err) {
    console.error('Testimonials error:', err);
    res.status(500).json({ error: 'Failed to fetch testimonials', message: err.message });
    console.error('Testimonials error:', err);
    res.status(500).json({ error: 'Failed to fetch testimonials', message: err.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    await connectDB();
    const submission = new Contact(req.body);
    await submission.save();
    res.json({ success: true, id: submission._id });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Failed to submit contact form', message: err.message });
  }
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Failed to submit contact form', message: err.message });
});

// Handle 404s (unchanged)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Export the serverless function (unchanged)
export default serverless(app);

