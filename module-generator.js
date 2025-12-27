const fs = require('fs')
const path = require('path')

// node module-generator.js src/inventory-module inventory-settings

if (process.argv.length < 4) {
  console.error('Requires path and name')
  process.exit(1)
}
const _path = process.argv[2]
const name = process.argv[3]

const directoryPath = `${_path}/${name}`
if (fs.existsSync(directoryPath)) {
  console.error(`Directory ${directoryPath} already exists.`)
  process.exit(1)
}
/**
 *
 * @param {string} fileName
 * @param {string} content
 */
function createFile(fileName, content) {
  let p = path.normalize(directoryPath + '/' + fileName)
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true }) // Create the directory (including parent directories if needed)
  }
  fs.writeFile(path.normalize(p), content.trimStart(), (err) => {
    if (err) {
      console.error(`Error creating the file: ${err}`)
    } else {
      console.log(`Generated ` + fileName)
    }
  })
}

function snakeOrKebabToCamel(input = '') {
  return input
    .replace(/[-_]\w/g, (match) => match.charAt(1).toUpperCase())
    .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase())
}

function camelToUnderscore(input) {
  return input.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

const className = snakeOrKebabToCamel(name)
const underscore_name = camelToUnderscore(className)

createFile(
  `/dto/${name}.dto.ts`,
  `
export class CreateDto {
    name: string;
    logo: string;
    description: string;
}

export class UpdateDto extends CreateDto {
    id: string;
}  
`
)

createFile(
  `/${name}.controller.ts`,
  `
import IdProps from "../../common/types/Id";
import { PaginatePropsType } from "../../common/types/paginate-props";

import on from "../../receiver";
import service from "./${name}.service";
import { CreateDto, UpdateDto } from "./dto/${name}.dto";

const prefix = "${name}";

on<CreateDto>(\`\${prefix}.create\`, async (data, user) => {
  const rst = await service.add(data, user);
  return rst;
});

on<UpdateDto>(\`\${prefix}.update\`, async (data, user) => {
  await service.update(data, user);
});

on(IdProps, \`\${prefix}.get\`, async ({id}, user) => {
  const rst = await service.getOne(id, user);
  return rst;
});

on<PaginatePropsType>(\`\${prefix}.getAll\`, async (paginate, user) => {
  const rst = await service.getAll(paginate, user);
  return rst;
});

on(IdProps, \`\${prefix}.delete\`, async (id, user) => {
  const rst = await service.delete(id, user);
  return rst;
});

`
)
createFile(
  `/${name}.service.ts`,
  `
import IdProps from "../../common/types/Id";
import { PaginatePropsType } from "../../common/types/paginate-props";
import UserPrincipal from "../../common/types/user-principal";
import PaginateUtil from "../../util/PaginateUtil";

import { ${className}Repo } from "./${name}.repo";
import { CreateDto, UpdateDto } from "./dto/${name}.dto";
import { DataSource, FindOptionsWhere } from "typeorm";
import { ${className} } from "./${name}.entity";

const Repo = ${className}Repo;

const IdStoreRepo = ;
const COMMON_ID = ;
const dataSource : DataSource = Repo.manager.connection;

class ${className}Service {

  async getAll(paginate: PaginatePropsType, user: UserPrincipal) {
    const repo = dataSource.manager.withRepository(Repo);
    const where: FindOptionsWhere<${className}> = { orgId: user.orgId };
    const count = await repo.countBy(where);
    const paginateData = PaginateUtil.convertForTypeOrm(paginate);
    const data = await repo.find({
      ...paginateData,
      where,
      order: { createdAt: "DESC" },
    });
    return { data, count };
  }

  delete(id: IdProps, user: UserPrincipal) {
    return dataSource.transaction(async (transactionManager) => {
      const repo = transactionManager.withRepository(Repo);
      await repo.delete({...id, orgId: user.orgId});
    });
  }
  
  add(newOne: CreateDto, user: UserPrincipal) {
    return dataSource.transaction(async (transactionManager) => {
      const repo = transactionManager.withRepository(Repo);
      const idGenRepo = transactionManager.withRepository(IdStoreRepo);
      const code = await idGenRepo.getNextId(COMMON_ID, user.orgId);
      const entity = repo.create({
        ...newOne,
        code,
        orgId: user.orgId,
      });
      await idGenRepo.increaseNextId(COMMON_ID, user.orgId);
      const data = await repo.save(entity);
      return data;
    });
  }

  update({id, ...newOne}: UpdateDto, user: UserPrincipal) {
    return dataSource.transaction(async (transactionManager) => {
      const repo = transactionManager.withRepository(Repo);
      await repo.update({id, orgId: user.orgId}, newOne);
    });
  }

  async getOne(id: any, user: UserPrincipal) {
    const repo = dataSource.manager.withRepository(Repo);
    const where: FindOptionsWhere<${className}> = { orgId: user.orgId, id };
    const data = await repo.findOne({ where });
    return data;
  }
}

export default new ${className}Service();
`
)

createFile(
  `/${name}.repo.ts`,
  `
import { ${className} } from "./${name}.entity";
import { DataSource } from "typeorm";

const dataSource : DataSource = ;

export const ${className}Repo = dataSource.getRepository(${className}).extend({});
`
)

createFile(
  `/${name}.entity.ts`,
  `
import { Entity, PrimaryGeneratedColumn } from "typeorm";
import { OrgBasedEntity } from "../../common/schema/common/org-based.super.entity";

@Entity({ name: "${underscore_name}" })
export class ${className} extends OrgBasedEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ length: 20 })
  code: string;
}
`
)

createFile(`/index.ts`, `export * from './${name}.controller';`)
