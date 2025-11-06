import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import serverless from 'serverless-http';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

let db;
let client;
let cached = global.mongo;
if (!cached) cached = global.mongo = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGO_URI;
  if (!cached.promise) {
    cached.promise = new MongoClient(uri).connect().then((client) => {
      return {
        client,
        db: client.db("KarshanGhela"),
      };
    });
  }
  cached.conn = await cached.promise;
  return cached.conn.db;
}

app.get('/products', async (req, res) => {
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

app.get('/products/featured', async (req, res) => {
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

app.get('/categories', async (req, res) => {
  try {
    const database = await connectDB();
    const categories = await database.collection('categories').find({}).sort({ display_order: 1 }).toArray();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/testimonials', async (req, res) => {
  try {
    const database = await connectDB();
    const testimonials = await database.collection('testimonials').find({ is_active: true }).sort({ display_order: 1 }).toArray();
    res.json(testimonials);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

app.post('/contact', async (req, res) => {
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running on Vercel' });
});

export default serverless(app);
