import { MongoClient } from 'mongodb';

// MongoDB connection caching
let cachedDb = null;

async function connectDB() {
  if (cachedDb) {
    return cachedDb;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  try {
    const client = await MongoClient.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    cachedDb = client.db(process.env.MONGO_DB || 'KarshanGhela');
    return cachedDb;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;

  try {
    // Root route
    if (url === '/' || url === '/api') {
      return res.status(200).json({
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
    }

    // Health check (no DB)
    if (url === '/api/health') {
      return res.status(200).json({
        status: 'ok',
        message: 'Server is running on Vercel',
        timestamp: new Date().toISOString(),
        env: {
          hasMongoUri: !!process.env.MONGO_URI
        }
      });
    }

    // Test DB connection
    if (url === '/api/test-db') {
      try {
        await connectDB();
        return res.status(200).json({ status: 'connected', message: 'MongoDB connected' });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    // Products routes
    if (url === '/api/products' && method === 'GET') {
      const db = await connectDB();
      const products = await db.collection('products').find({}).sort({ display_order: 1 }).toArray();
      const categories = await db.collection('categories').find({}).toArray();

      const categoryMap = Object.fromEntries(categories.map(cat => [cat._id.toString(), cat]));
      const productsWithCategory = products.map(p => ({
        ...p,
        category: categoryMap[p.category_id?.toString()] || null
      }));

      return res.status(200).json(productsWithCategory);
    }

    if (url === '/api/products/featured' && method === 'GET') {
      const db = await connectDB();
      const products = await db.collection('products').find({ is_featured: true }).sort({ display_order: 1 }).toArray();
      const categories = await db.collection('categories').find({}).toArray();

      const categoryMap = Object.fromEntries(categories.map(cat => [cat._id.toString(), cat]));
      const productsWithCategory = products.map(p => ({
        ...p,
        category: categoryMap[p.category_id?.toString()] || null
      }));

      return res.status(200).json(productsWithCategory);
    }

    // Categories route
    if (url === '/api/categories' && method === 'GET') {
      const db = await connectDB();
      const categories = await db.collection('categories').find({}).sort({ display_order: 1 }).toArray();
      return res.status(200).json(categories);
    }

    // Testimonials route
    if (url === '/api/testimonials' && method === 'GET') {
      const db = await connectDB();
      const testimonials = await db.collection('testimonials').find({ is_active: true }).sort({ display_order: 1 }).toArray();
      return res.status(200).json(testimonials);
    }

    // Contact form
    if (url === '/api/contact' && method === 'POST') {
      const db = await connectDB();
      const submission = {
        ...req.body,
        status: 'pending',
        created_at: new Date()
      };
      const result = await db.collection('contact_submissions').insertOne(submission);
      return res.status(200).json({ success: true, id: result.insertedId });
    }

    // 404 for all other routes
    return res.status(404).json({ error: 'Not found', path: url });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}