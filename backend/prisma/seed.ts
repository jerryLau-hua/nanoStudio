import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/encryption';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');

    // 创建测试用户
    const testPassword = await hashPassword('Test123456!');

    const user = await prisma.user.upsert({
        where: { email: 'test@nano.studio' },
        update: {},
        create: {
            email: 'test@nano.studio',
            username: 'testuser',
            password: testPassword,
            settings: {
                create: {
                    apiUrl: 'https://api.deepseek.com/chat/completions',
                    model: 'deepseek-chat',
                    // apiKeyEncrypted will be set by user later
                }
            }
        }
    });

    console.log('✅ Created test user:', user.email);

    // 创建示例会话
    const session = await prisma.notebookSession.create({
        data: {
            userId: user.id,
            title: '欢迎使用 Nano Studio',
            preview: '这是一个示例会话',
            sources: {
                create: [
                    {
                        userId: user.id,
                        name: 'Nano Studio 使用指南',
                        type: 'text',
                        status: 'ready',
                        content: '欢迎使用 Nano Studio！这是一个智能知识管理平台...',
                        metadata: {
                            wordCount: 100
                        }
                    }
                ]
            },
            messages: {
                create: [
                    {
                        role: 'user',
                        content: '你好，Nano Studio 有哪些功能？',
                        timestamp: Date.now()
                    },
                    {
                        role: 'assistant',
                        content: 'Nano Studio 提供两大核心功能：\n1. Notebook LM - 智能知识管理\n2. Code Archaeologist - 代码分析工具',
                        timestamp: Date.now() + 1000
                    }
                ]
            }
        }
    });

    console.log('✅ Created sample session:', session.title);

    console.log('\n🎉 Database seeding completed!');
    console.log('\n📝 Test Account:');
    console.log('   Email: test@nano.studio');
    console.log('   Password: Test123456!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
