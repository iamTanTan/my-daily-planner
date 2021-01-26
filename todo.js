//imports and set-up

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const _ = require('lodash');

const PORT = process.env.PORT || 3000;

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));


/********************************************************************************/
// Connect to mongoDB with mongoose
mongoose.connect("mongodb+srv://admin-tanner:Tanman11!!@cluster0.hukuy.mongodb.net/todolistDB?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


// Schema for individual items on each list
const itemSchema = {
  name: String
};

const Item = mongoose.model("Item", itemSchema);

// Create initial items for given list

const item1 = new Item({
  name: "Welcome to the todolist!"
});
const item2 = new Item({
  name: "Hit + to add more items."
});
const item3 = new Item({
  name: "<-- Hit this to delete an item."
});

const defaultItems = [item1, item2, item3];

//  Schema for all lists
const listSchema = {
  name: String,
  items: [itemSchema]
}

const List = mongoose.model("List", listSchema);


/********************************************************************************/
// Routing for list
app.get("/todo", function (req, res) {


  Item.find({}, function (err, items) {

    if (items.length === 0) {
      Item.insertMany(defaultItems).then(() => {
        console.log("Data Inserted");
      }).catch((err) => {
        console.log(err);
      });
      res.redirect("/");
    } else {
      res.render("list", {
        listTitle: "Today",
        newListItems: items
      });
    }

  });
});

// add items to list with corresponding list name
app.post("/todo", function (req, res) {

  const itemName = req.body.newItem;
  const listName = req.body.list;

  const anotherItem = new Item({
    name: itemName
  });

  if (listName === "Today") {
    anotherItem.save();
    res.redirect("/");
  } else {
    List.findOne({
      name: listName
    }, function (err, foundList) {
      if (err) {
        console.log(err);
      } else {
        foundList.items.push(anotherItem);
        foundList.save();
        res.redirect("/" + listName);
      }
    });
  }

});

// Deletes an item with check
app.post("/delete", (req, res) => {

  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  // Delete item from existing list
  if (listName === "Today") {
    Item.findByIdAndRemove(checkedItemId, (err) => {
      if (!err) {
        console.log("Delete successful!");
      }
    })
    res.redirect("/");
  } else {
    // Delete item from custom list
    List.findOneAndUpdate({
      name: listName
    }, {
      $pull: {
        items: {
          _id: checkedItemId
        }
      }
    }, (err, foundlist) => {
      res.redirect("/" + listName);
    })
  }
});

// Routing to create more custom Lists
app.get("/:listName", (req, res) => {

  const listName = _.capitalize(req.params.listName);

  List.findOne({
    name: listName
  }, (err, foundList) => {
    if (!err) {
      if (!foundList) {
        //  Create a new List since one does not yet exist
        const list = new List({
          name: listName,
          items: defaultItems
        });

        list.save();
        // Reload
        res.redirect("/" + listName);
      } else {
        // Render Existing List
        res.render("list", {
          listTitle: foundList.name,
          newListItems: foundList.items
        });
      }
    }
  });

});
