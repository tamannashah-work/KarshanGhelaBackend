import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { Resend } from 'resend';


dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let db;
let client;

async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGO_URI || process.env.VITE_MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI environment variable is not defined');
  }

  client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB Atlas');
  db = client.db('KarshanGhela');
  return db;
}

app.get('/api/products', async (req, res) => {
  try {
    const database = await connectDB();
    const productsCollection = database.collection('products');
    const categoriesCollection = database.collection('categories');

    const products = await productsCollection.find({}).sort({ display_order: 1 }).toArray();
    const categories = await categoriesCollection.find({}).toArray();

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat;
    });

    const productsWithCategory = products.map(product => ({
      ...product,
      category: categoryMap[product.category_id?.toString()] || null
    }));

    res.json(productsWithCategory);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/featured', async (req, res) => {
  try {
    const database = await connectDB();
    const productsCollection = database.collection('products');
    const categoriesCollection = database.collection('categories');

    const products = await productsCollection
      .find({ is_featured: true })
      .sort({ display_order: 1 })
      .toArray();

    const categories = await categoriesCollection.find({}).toArray();

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = cat;
    });

    const productsWithCategory = products.map(product => ({
      ...product,
      category: categoryMap[product.category_id?.toString()] || null
    }));

    res.json(productsWithCategory);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const database = await connectDB();
    const categoriesCollection = database.collection('categories');

    const categories = await categoriesCollection
      .find({})
      .sort({ display_order: 1 })
      .toArray();

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/testimonials', async (req, res) => {
  try {
    const database = await connectDB();
    const testimonialsCollection = database.collection('testimonials');

    const testimonials = await testimonialsCollection
      .find({ is_active: true })
      .sort({ display_order: 1 })
      .toArray();

    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const database = await connectDB();
    const contactCollection = database.collection('contact_submissions');

    const submission = {
      ...req.body,
      status: 'pending',
      created_at: new Date()
    };

    const result = await contactCollection.insertOne(submission);

    // --- SEND EMAIL VIA RESEND SDK ---
    if (process.env.RESEND_API_KEY) {
      try {
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        await resend.emails.send({
          from: 'onboarding@resend.dev', // You can only change this after verifying a domain in Resend
          to: process.env.EMAIL,
          subject: `New Enquiry from ${req.body.name} - ${now}`,
          html: `
            <h3>New Enquiry From ${req.body.name}</h3>
            <p>${req.body.message}</p>
            <br>
            <p><strong>Contact Details-</strong></p>
            <p>${req.body.email}</p>
            <p>Phone: ${req.body.phone}</p>
          `
        });
        console.log('Email sent via Resend');
      } catch (emailError) {
        console.error('Resend error:', emailError);
      }
    }
    // ---------------------------------

    res.json({
      success: true,
      id: result.insertedId
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

app.post('/api/indexnow', async (req, res) => {
  try {
    const { urlList } = req.body;

    if (!urlList || !Array.isArray(urlList)) {
      return res.status(400).json({ error: 'urlList is required and must be an array' });
    }

    const response = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': 'api.indexnow.org'
      },
      body: JSON.stringify({
        host: process.env.SITE_DOMAIN || 'karshanghela.com',
        key: process.env.INDEXNOW_KEY,
        keyLocation: `https://${process.env.SITE_DOMAIN || 'karshanghela.com'}/${process.env.INDEXNOW_KEY}.txt`,
        urlList: urlList
      })
    });

    if (response.ok) {
      console.log('Successfully submitted to IndexNow');
      res.json({ success: true, message: 'Submitted to IndexNow' });
    } else {
      const errorText = await response.text();
      console.error('IndexNow error:', response.status, errorText);
      res.status(response.status).json({ error: 'Failed to submit to IndexNow', details: errorText });
    }
  } catch (error) {
    console.error('Error submitting to IndexNow:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});
