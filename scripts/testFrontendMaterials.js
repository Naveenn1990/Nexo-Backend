// This script simulates what the frontend should receive
const materialCategories = [
  {
    name: 'Plumbing materials',
    icon: '🔧',
    items: [
      {
        name: "PVC Pipes",
        priceMin: 50,
        priceMax: 200,
        stock: 100,
        unit: "pieces",
        sku: "PVC-PIPE-001",
        brand: "Supreme",
        specifications: "1/2 inch diameter, 10 feet length"
      },
      {
        name: "Pipe Fittings",
        priceMin: 25,
        priceMax: 150,
        stock: 200,
        unit: "pieces",
        sku: "FITTING-001",
        brand: "Astral"
      }
    ]
  },
  {
    name: 'Switchboards and cables',
    icon: '⚡',
    items: [
      {
        name: "MCB 16A",
        priceMin: 150,
        priceMax: 400,
        stock: 80,
        unit: "pieces",
        sku: "MCB-16A-001",
        brand: "Schneider"
      }
    ]
  }
];

console.log('🎨 Testing Material Display Logic...');

materialCategories.forEach((category, categoryIndex) => {
  console.log(`\n📦 Category ${categoryIndex + 1}: ${category.name} (${category.icon})`);
  console.log(`   Items count: ${category.items?.length || 0}`);
  
  if (category.items && category.items.length > 0) {
    category.items.forEach((item, itemIndex) => {
      const itemName = typeof item === 'string' ? item : item.name;
      const itemPrice = typeof item === 'object' && item.priceMin && item.priceMax 
        ? `₹${item.priceMin}-₹${item.priceMax}` 
        : typeof item === 'object' && item.priceMin 
        ? `₹${item.priceMin}+` 
        : '';
      const itemStock = typeof item === 'object' && item.stock 
        ? `${item.stock} ${item.unit || 'units'}` 
        : '';
      
      console.log(`   ${itemIndex + 1}. ${itemName}`);
      if (itemPrice) console.log(`      Price: ${itemPrice}`);
      if (itemStock) console.log(`      Stock: ${itemStock}`);
      if (typeof item === 'object' && item.brand) console.log(`      Brand: ${item.brand}`);
      if (typeof item === 'object' && item.sku) console.log(`      SKU: ${item.sku}`);
    });
  } else {
    console.log('   ⚠️  No items found in this category');
  }
});

console.log('\n✅ Material display logic test completed!');
console.log('\n💡 Expected UI behavior:');
console.log('   - Each category should show as a card');
console.log('   - Items should be listed inside each card');
console.log('   - Price ranges and stock should be visible');
console.log('   - Brand and SKU badges should appear');
console.log('   - "Get Quotation" button should be at the bottom');