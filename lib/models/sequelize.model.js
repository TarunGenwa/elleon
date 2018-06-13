const {Model} = require('./class');
const SequelizeHelper = require('../helpers/sequelize.helper');
const graphqlFields                               = require('graphql-fields');
const _ = require('lodash');

class SequelizeModel extends Model {

    async loadGetSingle(instance) {
        if (instance.Query[this.queryGetSingleName]) return;

        let actualModel = this.model;
        instance.queries += this.makeRowStr('getSingle');
        instance.Query[this.queryGetSingleName] = async (parent, args, {}, info) => {

            let requested = graphqlFields(info);

            let includes = SequelizeHelper.getIncludes(requested, this, instance.models);

            let data;
            try {
                data = await actualModel.findOne({where: args.where, include: includes});
            } catch (err) {
                console.log('err', err);
                return false
            }

            return SequelizeHelper.getResolverValues(requested, data);
        }

    }

    async loadGetAll(instance){
        let actualModel = this.model;

        if (instance.Query[this.queryGetAllName]) return;

        let newStr = this.makeRowStr('getAll');
        if(!newStr) return;

        instance.queries += newStr;
        instance.Query[this.queryGetAllName] = async (parent, args, {}, info) => {
            let query = Object.assign({}, args);

            let model_params = {};
            if(query.limit)  {
                model_params.limit = args.limit;
                delete query.limit;
            }
            if(query.offset) {
                model_params.offset = args.offset;
                delete query.offset;
            }

            let requested = graphqlFields(info);

            let includes = SequelizeHelper.getIncludes(requested, this, instance.models);

            model_params.where   = args.where;
            model_params.include = includes;

            let data;

            try {
                data = await actualModel.findAll(model_params);
            } catch (err) {
                return false
            }

            return SequelizeHelper.getResolverValues(requested, data);
        }
    }

    async loadCreate(instance){
        if(!this.can('create')) return;
        if (instance.Mutation[this.mutationCreateName]) return;

        instance.mutations += this.makeRowStr('create');

        let actualModel = this.model;

        instance.Mutation[this.mutationCreateName] = async (parent, args, {}, info) => {
            let createData = args.data;
            let being;
            try{
                being = await actualModel.create(createData)
            }catch(err){

            }

            if(!being) return false;

            return being.toJSON();
        };
    }

    async loadUpdate(instance){
        if(!this.can('update')) return;
        if (instance.Mutation[this.mutationUpdateName]) return;

        instance.mutations += this.makeRowStr('update');

        let actualModel = this.model;

        instance.Mutation[this.mutationUpdateName] = async (parent, args, {}, info) => {
            let updateData = args.data;
            let queryData = args.where;

            let stats;

            try {
                stats = await actualModel.update(updateData, {where:queryData})
            } catch (err) {
                return {
                    success:false,
                    message: err.toString(),
                }
            }

            return {
                success: true,
                message: `Successfully updated data with model ${this.capName}`,
            };
        }
    }

    async loadDelete(instance){
        if(!this.can('delete')) return;
        if (instance.Mutation[this.mutationDeleteName]) return;

        instance.mutations += this.makeRowStr('delete');

        let actualModel = this.model;

        instance.Mutation[this.mutationDeleteName] = async (parent, args, {}, info) => {
            let queryData = args.where;

            let stats;

            try {
                stats = await actualModel.destroy({where:queryData});
            } catch (err) {
                return {
                    success:false,
                    message: err.toString(),
                }
            }

            return {
                success: true,
                message: `Successfully deleted data with model ${this.capName}`,
            };
        }
    }
}
module.exports.SequelizeModel = SequelizeModel;
