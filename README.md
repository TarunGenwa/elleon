# Elleon
A Graph QL framework for Node.js

## Getting Started
```angular2html
npm i elleon
```

## Example

```angular2html
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');


const models = require('./models');)
let Elleon = require('elleon');

let elleon = new Elleon({sequelize_models:models, resolvers:__dirname+'./resolvers'});
let schema = elleon.makeExecuteableSchema();
let graph_app = graphqlExpress({
                    schema: schema,
                    context: {
                      models,
                  }),
                  
app.use(
 '/graphql',
  bodyParser.json(),
  graph_app,
);
```

# More Coming...