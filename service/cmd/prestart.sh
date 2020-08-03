
# creating database and running migration
echo "running database migrations"
#./node_modules/.bin/sequelize db:create
./node_modules/.bin/sequelize db:migrate
./node_modules/.bin/sequelize db:seed:all

