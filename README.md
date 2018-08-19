# Elleon
A Graph QL framework for Node.js

## Getting Started
```angular2html
npm i elleon
```

## Example
#### Apollo Server 1
```angular2html
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');


const models = require('./models');)
let elleon = require('elleon');

const elleonInstance = new elleon({logging:false, subscriptions:true, sequelize:{models:models} , resolver_path:__dirname+'/resolvers', });
let schema = elleonInstance.makeExecuteableSchema();
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

#### Apollo Server 2
```angular2html
const { ApolloServer } = require('apollo-server-express');
const cors          = require('cors');
const models        = require('./models');
const elleon        = require('elleon');

const app = express();
app.use(cors('*'));


const elleonInstance = new elleon({logging:false, subscriptions:true, sequelize:{models:models} , resolver_path:__dirname+'/resolvers', });
const typesResolvers = elleonInstance.getTypeDefsAndResolvers();

const server = new ApolloServer({ typeDefs:typesResolvers.typeDefs, resolvers:typesResolvers.resolvers });
server.applyMiddleware({ app });

let port = 3000;
app.listen({ port }, () =>
    console.log(`Server ready at http://localhost:${port}${server.graphqlPath}`),
);
```
# More Coming...