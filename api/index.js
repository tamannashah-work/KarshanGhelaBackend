import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import serverless from "serverless-http";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB cached connection object
let cached = global.mongo;
if (!cached) {
  cached = global.mongo = { client: null, db: null, promise: null };
}

async function connectDB() {
  if (cached.db) return cached.db;

  const uri = process.env.MONGO_URI || process.env.VITE_MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not defined");
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      cached.client = new MongoClient(uri);
      await cached.client.connect();
      cached.db = cached.client.db("KarshanGhela");
      console.log("Connected to MongoDB Atlas");
      return cached.db;
    })();
  }
  await cached.promise;
  return cached.db;
}

// API routes
app.get("/api/products", async (req, res) => {
  try {
    const database = await connectDB();
    const productsCollection = database.collection("products");
    const categoriesCollection = database.collection("categories");

    const products = await productsCollection.find({}).sort({ display_order: 1 }).toArray();
    const categories = await categoriesCollection.find({}).toArray();

    const categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat._id.toString()] = cat;
    });

    const productsWithCategory = products.map((product) => ({
      ...product,
      category: categoryMap[product.category_id?.toString()] || null,
    }));

    res.json(productsWithCategory);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/products/featured", async (req, res) => {
  try {
    const database = await connectDB();
    const productsCollection = database.collection("products");
    const categoriesCollection = database.collection("categories");

    const products = await productsCollection
      .find({ is_featured: true })
      .sort({ display_order: 1 })
      .toArray();

    const categories = await categoriesCollection.find({}).toArray();

    const categoryMap = {};
    categories.forEach((cat) => {
      categoryMap[cat._id.toString()] = cat;
    });

    const productsWithCategory = products.map((product) => ({
      ...product,
      category: categoryMap[product.category_id?.toString()] || null,
    }));

    res.json(productsWithCategory);
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const database = await connectDB();
    const categoriesCollection = database.collection("categories");

    const categories = await categoriesCollection
      .find({})
      .sort({ display_order: 1 })
      .toArray();

    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get("/api/testimonials", async (req, res) => {
  try {
    const database = await connectDB();
    const testimonialsCollection = database.collection("testimonials");

    const testimonials = await testimonialsCollection
      .find({ is_active: true })
      .sort({ display_order: 1 })
      .toArray();

    res.json(testimonials);
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const database = await connectDB();
    const contactCollection = database.collection("contact_submissions");

    const submission = {
      ...req.body,
      status: "pending",
      created_at: new Date(),
    };

    const result = await contactCollection.insertOne(submission);

    res.json({
      success: true,
      id: result.insertedId,
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({ error: "Failed to submit contact form" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// For 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

export default serverless(app);
