import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import serverless from 'serverless-http';

dotenv.config();

const app = express();

// ✅ Proper CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ✅ Correct MongoDB connection caching for Vercel
let cached = global.mongo;
if (!cached) cached = global.mongo = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn.db;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing");

  if (!cached.promise) {
    cached.promise = new MongoClient(uri).connect().then((client) => {
      return { client, db: client.db("KarshanGhela") };
    });
  }

  cached.conn = await cached.promise;
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

export default serverless(app);
