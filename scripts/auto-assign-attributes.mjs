import { connectDB } from "../packages/db/src/connection.js";
import { Product } from "../packages/db/src/models/Product.js";

async function run() {
  await connectDB();
  
  const products = await Product.find({});
  let updatedCount = 0;

  for (const product of products) {
    let changed = false;
    const name = product.name.toLowerCase();
    const categorySlug = product.categorySlug;
    
    // Mongoose docs need to be converted to plain objects to modify arrays easily or we use markModified
    const variants = product.variants.map(v => v.toObject());

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const attrs = variant.attributes || {};

      // Auto-detect Sweep Size
      if (name.includes("56")) attrs["sweep-size"] = "56";
      else if (name.includes("48")) attrs["sweep-size"] = "48";
      else if (name.includes("36")) attrs["sweep-size"] = "36";
      else if (name.includes("24")) attrs["sweep-size"] = "24";
      else if (name.includes("20")) attrs["sweep-size"] = "20";
      else if (name.includes("18")) attrs["sweep-size"] = "18";
      else if (name.includes("14")) attrs["sweep-size"] = "14";
      else if (name.includes("12")) attrs["sweep-size"] = "12";
      else if (name.includes("10")) attrs["sweep-size"] = "10";
      else if (name.includes("8")) attrs["sweep-size"] = "8";

      // Auto-detect Motor Type
      if (name.includes("ac/dc") || name.includes("ac-dc")) attrs["motor-type"] = "ac-dc";
      else if (name.includes("inverter")) attrs["motor-type"] = "inverter";
      else if (["ceiling-fans", "bracket-fans", "pedestal-fans"].includes(categorySlug)) {
        if (!attrs["motor-type"]) attrs["motor-type"] = "ac";
      }

      // Auto-detect Winding
      if (name.includes("copper") || ["ceiling-fans", "bracket-fans", "exhaust-fans", "pedestal-fans"].includes(categorySlug)) {
        attrs["winding"] = "copper";
      }

      // Auto-detect Body Type for Exhaust Fans
      if (categorySlug === "exhaust-fans") {
        if (name.includes("plastic")) attrs["body-type"] = "plastic";
        else if (name.includes("metal")) attrs["body-type"] = "metal";
      }

      // Auto-detect Room Cooler attributes
      if (categorySlug === "room-coolers") {
        if (name.includes("plastic")) attrs["body-type"] = "plastic";
        if (name.includes("honeycomb")) attrs["cooling-pad"] = "honeycomb";
      }

      variant.attributes = attrs;
      changed = true;
    }

    if (changed) {
      const allSlugs = new Set(product.attributeSlugs || []);
      variants.forEach(v => {
        Object.keys(v.attributes).forEach(k => allSlugs.add(k));
      });
      
      await Product.updateOne(
        { _id: product._id },
        { 
          $set: { 
            variants: variants,
            attributeSlugs: Array.from(allSlugs)
          } 
        }
      );
      updatedCount++;
    }
  }

  console.log(`Updated attributes for ${updatedCount} products.`);
  process.exit(0);
}

run().catch(console.error);
