import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// PATCH - Update user profile
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { name } = await request.json();

    if (name !== undefined && typeof name !== 'string') {
      return NextResponse.json({ error: '昵称格式不正确' }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        name: name?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ message: '个人信息已更新' });
  } catch (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// GET - Get user profile
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to get profile:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
