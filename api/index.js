import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import serverless from 'serverless-http';

const app = express();

// CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(express.json());

// MongoDB connection caching for Vercel
let cached = global.mongo;
if (!cached) {
  cached = global.mongo = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn.db;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = MongoClient.connect(uri, opts).then((client) => {
      return {
        client,
        db: client.db('KarshanGhela'),
      };
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn.db;
}

// Root route
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

// Health check (no DB required)
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

// Products routes
app.get('/api/products', async (req, res) => {
  try {
    const database = await connectDB();
    const products = await database.collection('products').find({}).sort({ display_order: 1 }).toArray();
    const categories = await database.collection('categories').find({}).toArray();

    const categoryMap = Object.fromEntries(categories.map(cat => [cat._id.toString(), cat]));
    const productsWithCategory = products.map(p => ({ 
      ...p, 
      category: categoryMap[p.category_id?.toString()] || null 
    }));

    res.json(productsWithCategory);
  } catch (err) {
    console.error('Products error:', err);
    res.status(500).json({ error: 'Failed to fetch products', message: err.message });
  }
});

app.get('/api/products/featured', async (req, res) => {
  try {
    const database = await connectDB();
    const products = await database.collection('products')
      .find({ is_featured: true })
      .sort({ display_order: 1 })
      .toArray();
    const categories = await database.collection('categories').find({}).toArray();

    const categoryMap = Object.fromEntries(categories.map(cat => [cat._id.toString(), cat]));
    const productsWithCategory = products.map(p => ({ 
      ...p, 
      category: categoryMap[p.category_id?.toString()] || null 
    }));

    res.json(productsWithCategory);
  } catch (err) {
    console.error('Featured products error:', err);
    res.status(500).json({ error: 'Failed to fetch featured products', message: err.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const database = await connectDB();
    const categories = await database.collection('categories')
      .find({})
      .sort({ display_order: 1 })
      .toArray();
    res.json(categories);
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories', message: err.message });
  }
});

app.get('/api/testimonials', async (req, res) => {
  try {
    const database = await connectDB();
    const testimonials = await database.collection('testimonials')
      .find({ is_active: true })
      .sort({ display_order: 1 })
      .toArray();
    res.json(testimonials);
  } catch (err) {
    console.error('Testimonials error:', err);
    res.status(500).json({ error: 'Failed to fetch testimonials', message: err.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const database = await connectDB();
    const submission = { 
      ...req.body, 
      status: 'pending', 
      created_at: new Date() 
    };
    const result = await database.collection('contact_submissions').insertOne(submission);
    res.json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Failed to submit contact form', message: err.message });
  }
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Export the serverless function
export default serverless(app);
