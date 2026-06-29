import { connectDB } from "../packages/db/src/connection.js";
import { Attribute } from "../packages/db/src/models/Attribute.js";

const categories = ["ceiling-fans", "bracket-fans", "pedestal-fans", "exhaust-fans", "room-coolers"];

async function run() {
  await connectDB();
  
  for (const categorySlug of categories) {
    const existing = await Attribute.findOne({ categorySlug, slug: "color" });
    if (!existing) {
      console.log(`Creating color attribute for ${categorySlug}`);
      await Attribute.create({
        categorySlug,
        slug: "color",
        label: "Color",
        options: [
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
          { value: "offwhite-brown", label: "Offwhite & Brown" },
          { value: "offwhite-orange", label: "Offwhite & Orange" },
          { value: "white-grey", label: "White & Grey" },
          { value: "darkwood", label: "Darkwood" },
          { value: "lightwood", label: "Lightwood" },
          { value: "gold", label: "Gold" },
          { value: "silver", label: "Silver" },
          { value: "copper", label: "Copper" },
          { value: "brown", label: "Brown" },
          { value: "grey", label: "Grey" },
          { value: "red", label: "Red" },
          { value: "blue", label: "Blue" },
          { value: "green", label: "Green" },
          { value: "a3", label: "A3" },
        ],
        cardPosition: "title-chips",
        isActive: true,
      });
    } else {
      console.log(`Color attribute already exists for ${categorySlug}`);
    }
  }
  
  process.exit(0);
}

run().catch(console.error);
