import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import serverless from 'serverless-http';

dotenv.config();

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
    throw new Error("Please define the MONGO_URI environment variable");
  }

  if (!cached.promise) {
    cached.promise = MongoClient.connect(uri).then((client) => {
      return {
        client,
        db: client.db(process.env.MONGO_DB || 'KarshanGhela'),
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

// Routes with /api prefix
app.get('/api/products', async (req, res) => {
  try {
    const database = await connectDB();
    const products = await database.collection('products').find({}).sort({ display_order: 1 }).toArray();
    const categories = await database.collection('categories').find({}).toArray();

    const categoryMap = Object.fromEntries(categories.map(cat => [cat._id.toString(), cat]));
    const productsWithCategory = products.map(p => ({ ...p, category: categoryMap[p.category_id?.toString()] || null }));

    res.json(productsWithCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/featured', async (req, res) => {
  try {
    const database = await connectDB();
    const products = await database.collection('products').find({ is_featured: true }).sort({ display_order: 1 }).toArray();
    const categories = await database.collection('categories').find({}).toArray();

    const categoryMap = Object.fromEntries(categories.map(cat => [cat._id.toString(), cat]));
    const productsWithCategory = products.map(p => ({ ...p, category: categoryMap[p.category_id?.toString()] || null }));

    res.json(productsWithCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const database = await connectDB();
    const categories = await database.collection('categories').find({}).sort({ display_order: 1 }).toArray();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/testimonials', async (req, res) => {
  try {
    const database = await connectDB();
    const testimonials = await database.collection('testimonials').find({ is_active: true }).sort({ display_order: 1 }).toArray();
    res.json(testimonials);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const database = await connectDB();
    const submission = { ...req.body, status: 'pending', created_at: new Date() };
    const result = await database.collection('contact_submissions').insertOne(submission);
    res.json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running on Vercel' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Karshan Ghela API',
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

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Export the serverless function
export default serverless(app);
