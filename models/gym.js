'use strict'
module.exports = (sequelize, DataTypes) => {
  var Gym = sequelize.define('Gym', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    address: DataTypes.STRING,
    exRaidTrigger: DataTypes.BOOLEAN,
    geo: DataTypes.STRING,
    googleMapsLink: DataTypes.STRING,
    gymkey: DataTypes.STRING,
    gymname: DataTypes.STRING,
    qualifier: DataTypes.STRING,
    region: DataTypes.STRING,
    reporterName: DataTypes.STRING,
    reporterId: DataTypes.INTEGER,
    lat: {
      type: DataTypes.DECIMAL,
      defaultValue: null
    },
    lon: {
      type: DataTypes.DECIMAL,
      defaultValue: null
    },
    removed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'gyms'
  })

  Gym.associate = function (models) {
    models.Gym.hasMany(models.Raid)
  }
  return Gym
}
