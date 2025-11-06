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
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// MongoDB connection caching for Vercel
let cached = global.mongo;
if (!cached) {
  cached = global.mongo = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn.db;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Please define the MONGO_URI environment variable inside .env");
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    cached.promise = MongoClient.connect(uri, opts).then((client) => {
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

// ✅ Routes
app.get('/products', async (req, res) => {
  try {
    const db = await connectDB();
    const products = await db.collection('products').find({}).sort({ display_order: 1 }).toArray();
    const categories = await db.collection('categories').find({}).toArray();
    const map = Object.fromEntries(categories.map(c => [c._id.toString(), c]));
    res.json(products.map(p => ({ ...p, category: map[p.category_id?.toString()] || null })));
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get('/products/featured', async (req, res) => {
  try {
    const db = await connectDB();
    const products = await db.collection('products').find({ is_featured: true }).sort({ display_order: 1 }).toArray();
    const categories = await db.collection('categories').find({}).toArray();
    const map = Object.fromEntries(categories.map(c => [c._id.toString(), c]));
    res.json(products.map(p => ({ ...p, category: map[p.category_id?.toString()] || null })));
  } catch {
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const db = await connectDB();
    res.json(await db.collection('categories').find({}).sort({ display_order: 1 }).toArray());
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get('/testimonials', async (req, res) => {
  try {
    const db = await connectDB();
    res.json(await db.collection('testimonials').find({ is_active: true }).sort({ display_order: 1 }).toArray());
  } catch {
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

app.post('/contact', async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection('contact_submissions').insertOne({ ...req.body, status: 'pending', created_at: new Date() });
    res.json({ success: true, id: result.insertedId });
  } catch {
    res.status(500).json({ error: "Failed to submit contact form" });
  }
});

app.get('/health', (req, res) => res.json({ status: "ok" }));

const handler = serverless(app);

// ⬅️ Very important: default export must be a named constant for Vercel runtime
export default handler;