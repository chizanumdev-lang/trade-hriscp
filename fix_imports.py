import os
import glob

files = glob.glob("/Users/chizanumidemili/Projects/tradevu-hr/server/src/graphql/resolvers/*.js")
for f in files:
    with open(f, "r") as file:
        content = file.read()
    content = content.replace("from '../utils", "from '../../utils")
    content = content.replace("from '../services", "from '../../services")
    content = content.replace("from '../jobs", "from '../../jobs")
    with open(f, "w") as file:
        file.write(content)
