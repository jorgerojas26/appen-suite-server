#!/bin/bash

if ! command -v jq &>/dev/null; then
	echo "Jq is not installed. Installing..."
	sudo apt install jq -y
fi

if ! command -v git &>/dev/null; then
	echo "Git is not installed. Installing..."
	sudo apt install git -y
fi

# docker exec mongo mongosh --eval "show dbs" --eval "use appen-suite" --eval "show collections" --eval 'db.users.insert({ "email": "jorgeluisrojasb@gmail.com", "password": "$2a$10$6V5oPpj877oTmbHQvQwa1eWWYY6QozVNaaZfPLDzoFkJIYrPrJc6u" })'

# Using curl to login to appen-suite-server
token=$(curl -X POST localhost:8000/auth/login -H 'Content-Type: application/json' -d '{"email": "jorgeluisrojasb@gmail.com", "password": "123456"}' | jq -r .token)

while read -r line; do
	curl -X POST localhost:8000/favorites -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "{\"name\": \"$line\", \"max_accounts_per_proxy\": 3}"
done <favorites.txt

while read -r line; do
	email=$(echo $line | awk '{print $1}')
	password=$(echo $line | awk '{print $2}')
	curl -X POST localhost:8000/accounts -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "{\"email\": \"$email\", \"password\": \"$password\"}"
done <accounts.txt
